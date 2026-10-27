-- Correção e cancelamento de vendas e pagamentos.
--
-- Nada é apagado: venda e pagamento cancelados ficam com status 'cancelled' (e
-- quem/quando cancelou) e saem do saldo devedor, que já só conta os ativos. Editar
-- a venda troca os itens (guardando as cópias de nome, preço e pontos dos que já
-- estavam nela) e marca quem/quando editou. Os pontos são acertados por movimentos
-- novos no livro (estorno ou ajuste), nunca editando linhas: depois de cada
-- operação, cada venda do cliente soma no livro exatamente os pontos que merece
-- (os dos itens se está ativa e quitada, zero se não). Como antes, a gravação é só
-- por funções; as tabelas continuam só com select para o app.

-- ---------------------------------------------------------------------------
-- Quem e quando corrigiu
-- ---------------------------------------------------------------------------

alter table public.sales
  add column edited_at timestamptz,
  add column edited_by uuid,
  add column cancelled_at timestamptz,
  add column cancelled_by uuid,
  add constraint sales_cancelled_valid
    check ((status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null));

comment on column public.sales.edited_by is 'Membro (auth.users.id) que fez a última edição.';
comment on column public.sales.cancelled_by is 'Membro (auth.users.id) que cancelou a venda.';

alter table public.payments
  add column cancelled_at timestamptz,
  add column cancelled_by uuid,
  add constraint payments_cancelled_valid
    check ((status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null));

comment on column public.payments.cancelled_by is 'Membro (auth.users.id) que cancelou o pagamento.';

-- ---------------------------------------------------------------------------
-- Livro de pontos: estorno, ajuste e (para o resgate) débito
-- ---------------------------------------------------------------------------

-- sale_reversal: a venda deixou de merecer pontos (cancelada, reaberta, editada
-- e ficou em aberto). sale_adjustment: diferença de uma venda que continua
-- quitada (edição) ou novo crédito depois de um estorno. redemption: pontos
-- gastos pelo cliente (o resgate vem em outro ticket; o saldo pode ficar negativo).
alter table public.points_ledger
  drop constraint points_ledger_kind_valid,
  add constraint points_ledger_kind_valid
    check (kind in ('sale_credit', 'sale_reversal', 'sale_adjustment', 'redemption')),
  add constraint points_ledger_sale_reversal_valid
    check (kind <> 'sale_reversal' or (sale_id is not null and points < 0)),
  add constraint points_ledger_sale_adjustment_valid
    check (kind <> 'sale_adjustment' or sale_id is not null),
  add constraint points_ledger_redemption_valid
    check (kind <> 'redemption' or points < 0);

-- Lança no livro, para cada venda do cliente, a diferença entre os pontos que ela
-- merece e os que já somou. Trava a linha do cliente (no key update, que não briga
-- com a trava das FKs) para dois acertos simultâneos não lançarem a mesma diferença.
create function private.sync_sale_points(p_store_id uuid, p_customer_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.customers c
  where c.store_id = p_store_id and c.id = p_customer_id
  for no key update;

  insert into public.points_ledger (store_id, customer_id, sale_id, kind, points)
  select p_store_id, p_customer_id, t.sale_id,
         case when t.target = 0 then 'sale_reversal'
              when not t.credited then 'sale_credit'
              else 'sale_adjustment' end,
         t.target - t.booked
  from (
    select s.id as sale_id,
           case when st.sale_id is not null and st.total_cents > 0
                     and st.paid_cents >= st.total_cents
                then pts.total else 0 end as target,
           coalesce(l.booked, 0) as booked,
           coalesce(l.credited, false) as credited
    from public.sales s
    left join private.customer_sale_standing(p_store_id, p_customer_id) st
      on st.sale_id = s.id
    cross join lateral (
      select coalesce(sum(i.points::bigint * i.quantity), 0)::integer as total
      from public.sale_items i where i.sale_id = s.id
    ) pts
    left join lateral (
      select sum(pl.points)::integer as booked, bool_or(pl.kind = 'sale_credit') as credited
      from public.points_ledger pl where pl.sale_id = s.id
    ) l on true
    where s.store_id = p_store_id and s.customer_id = p_customer_id
  ) t
  where t.target <> t.booked
  on conflict do nothing;
end;
$$;

revoke execute on function private.sync_sale_points(uuid, uuid) from public, anon, authenticated;

-- record_sale e record_payment chamam credit_paid_sales no fim; agora ela faz o
-- acerto completo (crédito, estorno e ajuste), sem precisar recriar as duas.
create or replace function private.credit_paid_sales(p_store_id uuid, p_customer_id uuid)
returns void
language sql
set search_path = ''
as $$
  select private.sync_sale_points(p_store_id, p_customer_id)
$$;

-- ---------------------------------------------------------------------------
-- Pagamentos sem venda para pagar
-- ---------------------------------------------------------------------------

-- Quanto dos pagamentos ativos do cliente não paga nenhuma venda ativa (seria um
-- crédito). Cancelar ou baixar uma venda já coberta por pagamento de dívida não
-- pode deixar sobra: a operação é recusada (PAYMENTS_EXCEED_DEBT) e o membro
-- cancela o pagamento antes. Pagamentos de vendas canceladas são cancelados junto,
-- e o da venda paga na hora acompanha o total, então a sobra só pode vir daí.
create function private.customer_unallocated_cents(p_store_id uuid, p_customer_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select (select coalesce(sum(p.amount_cents), 0)::bigint
            from public.payments p
           where p.store_id = p_store_id and p.customer_id = p_customer_id
             and p.status = 'active')
       - (select coalesce(sum(s.paid_cents), 0)::bigint
            from private.customer_sale_standing(p_store_id, p_customer_id) s)
$$;

revoke execute on function private.customer_unallocated_cents(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Operação: cancelar venda
-- ---------------------------------------------------------------------------

-- Cancela a venda e os pagamentos ligados a ela (o "pago agora"): a venda não
-- aconteceu. Erros: SALE_NOT_FOUND, SALE_CANCELLED, PAYMENTS_EXCEED_DEBT.
create function public.cancel_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_store uuid;
  v_customer uuid;
  v_status text;
begin
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  select m.store_id into v_store from public.store_members m where m.user_id = v_user;
  if v_store is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  select s.customer_id into v_customer
  from public.sales s where s.store_id = v_store and s.id = p_sale_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'SALE_NOT_FOUND';
  end if;

  -- Sempre o cliente antes da venda, como nas outras operações.
  if v_customer is not null then
    perform 1 from public.customers c
    where c.store_id = v_store and c.id = v_customer
    for update;
  end if;

  select s.status into v_status from public.sales s where s.id = p_sale_id for update;
  if v_status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'SALE_CANCELLED';
  end if;

  update public.sales
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user
  where id = p_sale_id;

  update public.payments
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user
  where store_id = v_store and sale_id = p_sale_id and status = 'active';

  if v_customer is not null then
    if private.customer_unallocated_cents(v_store, v_customer) > 0 then
      raise exception using errcode = 'P0001', message = 'PAYMENTS_EXCEED_DEBT';
    end if;
    perform private.sync_sale_points(v_store, v_customer);
  end if;
end;
$$;

revoke execute on function public.cancel_sale(uuid) from public, anon;
grant execute on function public.cancel_sale(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Operação: editar venda
-- ---------------------------------------------------------------------------

-- p_items como em record_sale: [{ product_id, quantity, unit_price_cents | null }].
-- Produto que já estava na venda mantém nome, pontos e (se o preço vier nulo) o
-- preço da época, e pode estar desativado; produto novo precisa estar ativo e
-- entra com os dados atuais do catálogo. Se a venda tem pagamento "pago agora"
-- ativo e o total mudou, ele é cancelado e substituído por um do novo total, na
-- mesma forma. Erros: INVALID_INPUT, SALE_NOT_FOUND, SALE_CANCELLED,
-- PRODUCT_NOT_FOUND, PRODUCT_INACTIVE, PAYMENTS_EXCEED_DEBT.
create function public.update_sale(p_sale_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_store uuid;
  v_customer uuid;
  v_status text;
  v_missing boolean;
  v_inactive boolean;
  v_rows jsonb;
  v_old_total bigint;
  v_total bigint;
  v_method text;
begin
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  select m.store_id into v_store from public.store_members m where m.user_id = v_user;
  if v_store is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  select s.customer_id into v_customer
  from public.sales s where s.store_id = v_store and s.id = p_sale_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'SALE_NOT_FOUND';
  end if;

  if v_customer is not null then
    perform 1 from public.customers c
    where c.store_id = v_store and c.id = v_customer
    for update;
  end if;

  select s.status into v_status from public.sales s where s.id = p_sale_id for update;
  if v_status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'SALE_CANCELLED';
  end if;

  with old as (
    select distinct i.product_id from public.sale_items i where i.sale_id = p_sale_id
  )
  select bool_or(p.id is null), bool_or(o.product_id is null and not p.is_active)
  into v_missing, v_inactive
  from jsonb_to_recordset(p_items) as i (product_id uuid)
  left join public.products p on p.store_id = v_store and p.id = i.product_id
  left join old o on o.product_id = i.product_id;

  if v_missing then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  end if;
  if v_inactive then
    raise exception using errcode = 'P0001', message = 'PRODUCT_INACTIVE';
  end if;

  select sum(i.unit_price_cents::bigint * i.quantity) into v_old_total
  from public.sale_items i where i.sale_id = p_sale_id;

  -- Monta os itens novos antes de apagar os antigos (as cópias vêm deles).
  with old as (
    select distinct on (i.product_id) i.product_id, i.product_name, i.unit_price_cents, i.points
    from public.sale_items i where i.sale_id = p_sale_id
    order by i.product_id, i.position
  )
  select jsonb_agg(jsonb_build_object(
           'position', e.position,
           'product_id', p.id,
           'product_name', coalesce(o.product_name, p.name),
           'unit_price_cents',
             coalesce((e.item ->> 'unit_price_cents')::integer, o.unit_price_cents, p.price_cents),
           'points', coalesce(o.points, p.points),
           'quantity', (e.item ->> 'quantity')::integer))
  into v_rows
  from jsonb_array_elements(p_items) with ordinality as e (item, position)
  join public.products p
    on p.store_id = v_store and p.id = (e.item ->> 'product_id')::uuid
  left join old o on o.product_id = p.id;

  delete from public.sale_items where sale_id = p_sale_id;

  -- Quantidade ou preço fora dos limites caem nas constraints (INVALID_INPUT).
  insert into public.sale_items
    (store_id, sale_id, position, product_id, product_name, unit_price_cents, points, quantity)
  select v_store, p_sale_id, r.position, r.product_id, r.product_name, r.unit_price_cents,
         r.points, r.quantity
  from jsonb_to_recordset(v_rows) as r (
    position smallint, product_id uuid, product_name text, unit_price_cents integer,
    points integer, quantity integer
  );

  select sum(i.unit_price_cents::bigint * i.quantity) into v_total
  from public.sale_items i where i.sale_id = p_sale_id;

  -- No máximo R$ 100.000,00 por venda (o mesmo limite do core).
  if v_total > 10000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  update public.sales set edited_at = now(), edited_by = v_user where id = p_sale_id;

  if v_total <> v_old_total then
    select p.method into v_method
    from public.payments p
    where p.store_id = v_store and p.sale_id = p_sale_id and p.status = 'active'
    order by p.created_at desc
    limit 1;

    if v_method is not null then
      update public.payments
      set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user
      where store_id = v_store and sale_id = p_sale_id and status = 'active';

      insert into public.payments
        (store_id, customer_id, sale_id, amount_cents, method, recorded_by)
      values (v_store, v_customer, p_sale_id, v_total::integer, v_method, v_user);
    end if;
  end if;

  if v_customer is not null then
    if private.customer_unallocated_cents(v_store, v_customer) > 0 then
      raise exception using errcode = 'P0001', message = 'PAYMENTS_EXCEED_DEBT';
    end if;
    perform private.sync_sale_points(v_store, v_customer);
  end if;
end;
$$;

revoke execute on function public.update_sale(uuid, jsonb) from public, anon;
grant execute on function public.update_sale(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Operação: cancelar pagamento
-- ---------------------------------------------------------------------------

-- O valor volta a ser devido: a venda que ele quitava reabre e os pontos dela são
-- estornados. O pagamento da venda avulsa não pode ser cancelado sozinho (não há
-- de quem cobrar): cancela-se a venda. Erros: PAYMENT_NOT_FOUND,
-- PAYMENT_CANCELLED, WALK_IN_SALE_PAYMENT.
create function public.cancel_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_store uuid;
  v_customer uuid;
  v_status text;
begin
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  select m.store_id into v_store from public.store_members m where m.user_id = v_user;
  if v_store is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  select p.customer_id into v_customer
  from public.payments p where p.store_id = v_store and p.id = p_payment_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND';
  end if;
  if v_customer is null then
    raise exception using errcode = 'P0001', message = 'WALK_IN_SALE_PAYMENT';
  end if;

  perform 1 from public.customers c
  where c.store_id = v_store and c.id = v_customer
  for update;

  select p.status into v_status from public.payments p where p.id = p_payment_id for update;
  if v_status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'PAYMENT_CANCELLED';
  end if;

  update public.payments
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user
  where id = p_payment_id;

  perform private.sync_sale_points(v_store, v_customer);
end;
$$;

revoke execute on function public.cancel_payment(uuid) from public, anon;
grant execute on function public.cancel_payment(uuid) to authenticated;
