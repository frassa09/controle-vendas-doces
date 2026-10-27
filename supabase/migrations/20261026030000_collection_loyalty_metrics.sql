-- Métricas de cobrança e fidelidade de um período.
--
-- Duas funções novas (security invoker: o RLS limita tudo à loja de quem chama),
-- chamadas pelo core junto com public.store_metrics, para o período e o anterior.
--
-- Cobrança: uma foto da carteira de fiado no fim do período (ou agora, se ele não
-- acabou). Só contam vendas e pagamentos ativos criados até esse instante, com a
-- mesma alocação de private.customer_sale_standing ("pago agora" na própria venda,
-- pagamentos de dívida nas vendas mais antigas primeiro).
--
--  - fiado de uma venda = o que não foi pago na hora (total - "pago agora");
--  - dívidas por faixa = o que segue em aberto, venda a venda, pela idade da venda
--    em dias inteiros: até 7, de 8 a 30, mais de 30 (as faixas da fila de cobrança);
--  - tempo até o pagamento = dias entre a venda fiado e o pagamento de dívida que
--    terminou de quitá-la; a média é das vendas quitadas dentro do período;
--  - INADIMPLÊNCIA = do valor vendido fiado há mais de 30 dias (contados até o fim
--    do período), a parte que continua em aberto. Dívida com até 30 dias ainda está
--    no prazo normal de pagamento e não entra na conta.
--
-- Fidelidade: movimentos do livro de pontos, jogadas e cupons entregues no período.
--
--  - emitidos = créditos de vendas quitadas (inclui ajuste positivo de venda editada);
--  - estornados = estornos e ajustes negativos (venda cancelada, editada ou reaberta);
--  - gastos = troca direta ('redemption') e raspadinha ('scratch'), separados;
--  - vencidos = movimentos 'expiration'. O vencimento é gravado de forma preguiçosa,
--    então o core chama public.expire_store_points antes de ler;
--  - custo da fidelidade = preço atual dos produtos dos cupons entregues no período
--    (o cupom guarda o produto, não o preço da hora).

-- Cobrança --------------------------------------------------------------------------

create function public.collection_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  -- Dívida com mais de tantos dias conta para a inadimplência (a faixa "mais de 30").
  c_overdue_days constant integer := 30;
  v_ref timestamptz := least(p_to, now());
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if p_from >= p_to then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  with
  sale_totals as (
    select s.id, s.customer_id, s.created_at,
           (select coalesce(sum(i.unit_price_cents::bigint * i.quantity), 0)
              from public.sale_items i where i.sale_id = s.id) as total,
           (select coalesce(sum(p.amount_cents), 0)::bigint
              from public.payments p
             where p.sale_id = s.id and p.status = 'active' and p.created_at < v_ref) as direct
    from public.sales s
    where s.status = 'active' and s.customer_id is not null and s.created_at < v_ref
  ),
  dues as (
    select t.id, t.customer_id, t.created_at,
           greatest(t.total - t.direct, 0) as due,
           sum(greatest(t.total - t.direct, 0))
             over (partition by t.customer_id order by t.created_at, t.id) as due_through
    from sale_totals t
  ),
  -- Pagamentos de dívida até o instante da foto, com o acumulado do cliente.
  debt_payments as (
    select p.customer_id, p.created_at,
           sum(p.amount_cents::bigint)
             over (partition by p.customer_id order by p.created_at, p.id) as paid_through
    from public.payments p
    where p.status = 'active' and p.sale_id is null and p.created_at < v_ref
  ),
  pools as (
    select customer_id, max(paid_through) as amount from debt_payments group by customer_id
  ),
  -- Só vendas com fiado (due > 0): quanto falta, idade e quando foram quitadas.
  fiado as (
    select d.id, d.customer_id, d.created_at, d.due,
           d.due - least(d.due, greatest(coalesce(pl.amount, 0) - (d.due_through - d.due), 0))
             as open,
           floor(extract(epoch from v_ref - d.created_at) / 86400)::integer as age_days,
           (select min(dp.created_at) from debt_payments dp
             where dp.customer_id = d.customer_id and dp.paid_through >= d.due_through)
             as settled_at
    from dues d
    left join pools pl on pl.customer_id = d.customer_id
    where d.due > 0
  ),
  open_fiado as (
    select *,
           case when age_days <= 7 then 'upTo7' when age_days <= 30 then 'upTo30'
                else 'over30' end as band
    from fiado where open > 0
  ),
  settled as (
    select extract(epoch from greatest(settled_at, created_at) - created_at) / 86400 as days
    from fiado
    where open = 0 and settled_at >= p_from and settled_at < p_to
  ),
  overdue as (
    select coalesce(sum(due), 0)::bigint as fiado_cents,
           coalesce(sum(open), 0)::bigint as open_cents
    from fiado where age_days > c_overdue_days
  )
  select jsonb_build_object(
    'openCents', (select coalesce(sum(open), 0) from open_fiado),
    'debtorsCount', (select count(distinct customer_id) from open_fiado),
    'debtByAge', (
      select jsonb_object_agg(b.band, jsonb_build_object(
        'cents', coalesce(x.cents, 0), 'customersCount', coalesce(x.customers, 0)))
      from unnest(array['upTo7', 'upTo30', 'over30']) as b(band)
      left join (
        select band, sum(open)::bigint as cents, count(distinct customer_id) as customers
        from open_fiado group by band) x on x.band = b.band),
    'settledCount', (select count(*) from settled),
    'averageDaysToPay', (select round(avg(days)::numeric, 1) from settled),
    'defaultRate', (
      select jsonb_build_object(
        'overdueDays', c_overdue_days,
        'fiadoCents', o.fiado_cents,
        'openCents', o.open_cents,
        'percent', case when o.fiado_cents = 0 then null
                        else round(o.open_cents * 100.0 / o.fiado_cents, 1) end)
      from overdue o)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.collection_metrics(timestamptz, timestamptz)
  from public, anon;
grant execute on function public.collection_metrics(timestamptz, timestamptz)
  to authenticated;

-- Fidelidade ------------------------------------------------------------------------

create function public.loyalty_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if p_from >= p_to then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  with
  moves as (
    select l.kind, l.points
    from public.points_ledger l
    where l.created_at >= p_from and l.created_at < p_to
  ),
  plays as (
    select sp.won, sp.win_percent
    from public.scratch_plays sp
    where sp.created_at >= p_from and sp.created_at < p_to
  ),
  delivered as (
    select c.origin, p.price_cents::bigint as cents
    from public.coupons c
    join public.products p on p.store_id = c.store_id and p.id = c.product_id
    where c.status = 'delivered' and c.delivered_at >= p_from and c.delivered_at < p_to
  )
  select jsonb_build_object(
    'points', (
      select jsonb_build_object(
        'issued', coalesce(sum(points) filter (
          where kind in ('sale_credit', 'sale_adjustment') and points > 0), 0),
        'reversed', coalesce(-sum(points) filter (
          where kind in ('sale_reversal', 'sale_adjustment') and points < 0), 0),
        'redeemed', coalesce(-sum(points) filter (where kind = 'redemption'), 0),
        'scratched', coalesce(-sum(points) filter (where kind = 'scratch'), 0),
        'expired', coalesce(-sum(points) filter (where kind = 'expiration'), 0))
      from moves),
    'scratch', (
      select jsonb_build_object(
        'plays', count(*),
        'wins', count(*) filter (where won),
        'winPercent', case when count(*) = 0 then null
                           else round(count(*) filter (where won) * 100.0 / count(*), 1) end,
        'configuredPercent', round(avg(win_percent)::numeric, 1))
      from plays),
    'prizes', (
      select jsonb_build_object(
        'count', count(*),
        'costCents', coalesce(sum(cents), 0),
        'redemption', jsonb_build_object(
          'count', count(*) filter (where origin = 'redemption'),
          'cents', coalesce(sum(cents) filter (where origin = 'redemption'), 0)),
        'scratch', jsonb_build_object(
          'count', count(*) filter (where origin = 'scratch'),
          'cents', coalesce(sum(cents) filter (where origin = 'scratch'), 0)))
      from delivered)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.loyalty_metrics(timestamptz, timestamptz)
  from public, anon;
grant execute on function public.loyalty_metrics(timestamptz, timestamptz)
  to authenticated;

-- Vencimento de toda a loja ---------------------------------------------------------

-- Grava os vencimentos pendentes de todos os clientes da loja de quem chama (o mesmo
-- que a página e o perfil fazem cliente a cliente), para as métricas enxergarem os
-- pontos vencidos. Devolve quantos clientes tiveram pontos vencidos agora.
create function public.expire_store_points()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_store uuid;
  v_customer uuid;
  v_count integer := 0;
begin
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  select m.store_id into v_store from public.store_members m where m.user_id = v_user;
  -- Sem loja não há o que vencer (as métricas saem zeradas, como antes).
  if v_store is null then
    return 0;
  end if;
  if not exists (
    select 1 from public.stores s where s.id = v_store and s.points_validity_days is not null
  ) then
    return 0;
  end if;
  for v_customer in
    select c.id from public.customers c where c.store_id = v_store
  loop
    if private.points_expires_at(v_store, v_customer) <= now() then
      perform private.expire_customer_points(v_store, v_customer);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.expire_store_points() from public, anon;
grant execute on function public.expire_store_points() to authenticated;
