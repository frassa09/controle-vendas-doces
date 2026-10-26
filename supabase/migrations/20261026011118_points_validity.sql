-- Validade dos pontos.
--
-- Regra (inequívoca): se a loja define N dias de validade, os pontos do cliente
-- vencem N dias depois da sua última compra paga. "Compra paga" = o momento em
-- que uma venda ativa ficou totalmente quitada e deu pontos (movimento positivo
-- sale_credit/sale_adjustment de uma venda que ainda mantém pontos no livro).
-- Vencendo, o saldo inteiro vira um movimento negativo 'expiration' datado no
-- instante do vencimento. Uma nova compra paga depois disso começa um prazo novo.
-- Sem validade (nulo) os pontos nunca vencem.

alter table public.stores
  add column points_validity_days integer,
  add constraint stores_points_validity_valid
    check (points_validity_days is null or points_validity_days between 1 and 3650);

comment on column public.stores.points_validity_days is 'Dias até os pontos vencerem sem compra paga. Nulo = sem validade.';

grant update (points_validity_days) on public.stores to authenticated;

alter table public.points_ledger
  drop constraint points_ledger_kind_valid,
  add constraint points_ledger_kind_valid
    check (kind in ('sale_credit', 'sale_reversal', 'sale_adjustment', 'redemption', 'expiration')),
  add constraint points_ledger_expiration_valid
    check (kind <> 'expiration' or (sale_id is null and points < 0));

-- Quando vence o saldo atual do cliente; nulo se a loja não tem validade, o saldo
-- não é positivo ou o cliente nunca teve compra paga.
create function private.points_expires_at(p_store_id uuid, p_customer_id uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select last_paid.at + make_interval(days => st.points_validity_days)
  from public.stores st
  cross join lateral (
    select max(l.created_at) as at
    from public.points_ledger l
    where l.store_id = p_store_id and l.customer_id = p_customer_id
      and l.kind in ('sale_credit', 'sale_adjustment') and l.points > 0
      and (select sum(k.points) from public.points_ledger k where k.sale_id = l.sale_id) > 0
  ) last_paid
  where st.id = p_store_id
    and st.points_validity_days is not null
    and last_paid.at is not null
    and (select coalesce(sum(b.points), 0) from public.points_ledger b
          where b.store_id = p_store_id and b.customer_id = p_customer_id) > 0
$$;

revoke execute on function private.points_expires_at(uuid, uuid) from public, anon, authenticated;

-- Vence o saldo do cliente se o prazo já passou. Idempotente: depois de vencer o
-- saldo é zero e nada mais é lançado. Trava o cliente como sync_sale_points.
-- Devolve quando vence o saldo que sobrou (nulo se não houver validade/saldo).
create function private.expire_customer_points(p_store_id uuid, p_customer_id uuid)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  v_expires timestamptz;
begin
  perform 1 from public.customers c
  where c.store_id = p_store_id and c.id = p_customer_id
  for no key update;

  v_expires := private.points_expires_at(p_store_id, p_customer_id);
  if v_expires is not null and v_expires <= now() then
    insert into public.points_ledger (store_id, customer_id, kind, points, created_at)
    select p_store_id, p_customer_id, 'expiration', -sum(l.points), v_expires
    from public.points_ledger l
    where l.store_id = p_store_id and l.customer_id = p_customer_id;
    v_expires := null;
  end if;
  return v_expires;
end;
$$;

revoke execute on function private.expire_customer_points(uuid, uuid) from public, anon, authenticated;

-- Para o app: vence se for o caso e devolve quando vence o saldo atual.
create function public.expire_customer_points(p_customer_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_store uuid;
begin
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  select m.store_id into v_store from public.store_members m where m.user_id = v_user;
  if v_store is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.customers c where c.store_id = v_store and c.id = p_customer_id
  ) then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_NOT_FOUND';
  end if;
  return private.expire_customer_points(v_store, p_customer_id);
end;
$$;

revoke execute on function public.expire_customer_points(uuid) from public, anon;
grant execute on function public.expire_customer_points(uuid) to authenticated;

create or replace function public.get_customer_page(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
  v_store public.stores;
  v_points bigint;
  v_expires timestamptz;
  v_open jsonb;
  v_history jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select * into v_customer from public.customers c where c.link_token = p_token;
  if not found then
    return null;
  end if;

  -- Vence os pontos antes de ler o saldo (a leitura é o gatilho do vencimento).
  v_expires := private.expire_customer_points(v_customer.store_id, v_customer.id);

  select * into v_store from public.stores s where s.id = v_customer.store_id;

  select coalesce(sum(l.points), 0) into v_points
  from public.points_ledger l
  where l.store_id = v_customer.store_id and l.customer_id = v_customer.id;

  -- Vendas ainda não quitadas (FIFO), com o que falta de cada uma e os pontos que
  -- elas vão dar quando forem pagas.
  select coalesce(jsonb_agg(jsonb_build_object(
           'saleId', s.sale_id,
           'createdAt', s.created_at,
           'totalCents', s.total_cents,
           'remainingCents', s.total_cents - s.paid_cents,
           'points', pts.total,
           'items', items.list
         ) order by s.created_at, s.sale_id), '[]'::jsonb)
  into v_open
  from private.customer_sale_standing(v_customer.store_id, v_customer.id) s
  cross join lateral (
    select coalesce(sum(i.points::bigint * i.quantity), 0) as total
    from public.sale_items i where i.sale_id = s.sale_id
  ) pts
  cross join lateral (
    select jsonb_agg(jsonb_build_object('name', i.product_name, 'quantity', i.quantity)
             order by i.position) as list
    from public.sale_items i where i.sale_id = s.sale_id
  ) items
  where s.paid_cents < s.total_cents;

  -- Recadinhos: compras e pagamentos de dívida, do mais novo para o mais antigo.
  -- Os pontos creditados na mesma transação do evento (mesmo now()) acompanham o
  -- evento: a compra paga na hora ou o pagamento que quitou vendas. Pontos de uma
  -- venda que depois foram estornados (saldo da venda no livro zerado) não contam.
  with events as (
    select 'sale'::text as kind, s.id, s.created_at, s.status,
           (select coalesce(sum(i.unit_price_cents::bigint * i.quantity), 0)
              from public.sale_items i where i.sale_id = s.id) as amount,
           (select p.method from public.payments p
             where p.sale_id = s.id order by p.created_at limit 1) as method,
           (select jsonb_agg(jsonb_build_object('name', i.product_name, 'quantity', i.quantity)
                     order by i.position)
              from public.sale_items i where i.sale_id = s.id) as items
    from public.sales s
    where s.store_id = v_customer.store_id and s.customer_id = v_customer.id
    union all
    select 'payment', p.id, p.created_at, p.status, p.amount_cents::bigint, p.method, null
    from public.payments p
    where p.store_id = v_customer.store_id and p.customer_id = v_customer.id
      and p.sale_id is null
    order by created_at desc, id desc
    limit 40
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', e.kind,
           'id', e.id,
           'createdAt', e.created_at,
           'status', e.status,
           'amountCents', e.amount,
           'method', e.method,
           'items', e.items,
           'points', (select coalesce(sum(l.points), 0)
                        from public.points_ledger l
                       where l.store_id = v_customer.store_id
                         and l.customer_id = v_customer.id
                         and l.created_at = e.created_at
                         and (l.sale_id is null
                              or (select sum(k.points) from public.points_ledger k
                                   where k.sale_id = l.sale_id) > 0))
         ) order by e.created_at desc, e.id desc), '[]'::jsonb)
  into v_history
  from events e;

  return jsonb_build_object(
    'store', jsonb_build_object(
      'name', v_store.name,
      'brandColor', v_store.brand_color,
      'welcomeText', v_store.welcome_text,
      'logo', v_store.logo_data,
      'pixKey', v_store.pix_key,
      'city', v_store.city
    ),
    'customer', jsonb_build_object('name', v_customer.name),
    'points', v_points,
    'pointsExpiresAt', v_expires,
    -- Custos das recompensas. Fixos até os tickets de resgate e raspadinha os
    -- tornarem configuráveis (padrões da spec: 10 e 5 pontos).
    'redeemCost', 10,
    'scratchCost', 5,
    'openSales', v_open,
    'history', v_history
  );
end;
$$;
