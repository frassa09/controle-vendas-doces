-- Livro de pontos do cliente.
--
-- Cada movimento é uma linha; o saldo é a soma dos movimentos (nunca guardado).
-- Por enquanto só existe um tipo: 'sale_credit', o crédito dos pontos dos itens de
-- uma venda quando ela fica totalmente paga. O índice único em (sale_id) para esse
-- tipo garante o crédito exatamente uma vez, mesmo com pagamentos simultâneos.
-- Gravação só por funções (o app só tem select), como nas vendas.

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  customer_id uuid not null,
  -- Venda que gerou o movimento (obrigatória no crédito por venda).
  sale_id uuid,
  kind text not null,
  -- Positivo = crédito. Movimentos negativos (resgate) virão em outro ticket.
  points integer not null,
  created_at timestamptz not null default now(),
  constraint points_ledger_customer_fkey foreign key (store_id, customer_id)
    references public.customers (store_id, id),
  constraint points_ledger_sale_fkey foreign key (store_id, sale_id)
    references public.sales (store_id, id),
  constraint points_ledger_kind_valid check (kind in ('sale_credit')),
  constraint points_ledger_points_valid check (points <> 0),
  constraint points_ledger_sale_credit_valid check (kind <> 'sale_credit' or (sale_id is not null and points > 0))
);

comment on table public.points_ledger is 'Movimentos de pontos do cliente; saldo = soma de points.';

create unique index points_ledger_sale_credit_key on public.points_ledger (sale_id)
  where kind = 'sale_credit';
create index points_ledger_store_id_idx on public.points_ledger (store_id);
create index points_ledger_customer_idx on public.points_ledger (store_id, customer_id, created_at desc);

alter table public.points_ledger enable row level security;

create policy points_ledger_select_member on public.points_ledger
  for select to authenticated
  using (store_id in (select private.my_store_ids()));

revoke all on public.points_ledger from anon, authenticated;
grant select on public.points_ledger to authenticated;

-- Credita os pontos de toda venda do cliente que está totalmente paga e ainda não
-- foi creditada. Idempotente: roda depois de cada venda e de cada pagamento, e o
-- índice único impede o segundo crédito. Venda sem pontos não gera movimento.
create function private.credit_paid_sales(p_store_id uuid, p_customer_id uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.points_ledger (store_id, customer_id, sale_id, kind, points)
  select p_store_id, p_customer_id, s.sale_id, 'sale_credit', pts.total
  from private.customer_sale_standing(p_store_id, p_customer_id) s
  cross join lateral (
    select coalesce(sum(i.points::bigint * i.quantity), 0)::integer as total
    from public.sale_items i where i.sale_id = s.sale_id
  ) pts
  where s.total_cents > 0 and s.paid_cents >= s.total_cents and pts.total > 0
  on conflict do nothing
$$;

revoke execute on function private.credit_paid_sales(uuid, uuid) from public, anon, authenticated;

create or replace function public.record_sale(
  p_customer_id uuid, p_items jsonb, p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_store uuid;
  v_sale uuid;
  v_total bigint;
  v_missing boolean;
  v_inactive boolean;
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

  -- Venda avulsa não pode ser fiado: não haveria de quem cobrar.
  if p_payment_method is null and p_customer_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers c where c.store_id = v_store and c.id = p_customer_id
  ) then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_NOT_FOUND';
  end if;

  select bool_or(p.id is null), bool_or(not p.is_active)
  into v_missing, v_inactive
  from jsonb_to_recordset(p_items) as i (product_id uuid)
  left join public.products p on p.store_id = v_store and p.id = i.product_id;

  if v_missing then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  end if;
  if v_inactive then
    raise exception using errcode = 'P0001', message = 'PRODUCT_INACTIVE';
  end if;

  insert into public.sales (store_id, customer_id, recorded_by)
  values (v_store, p_customer_id, v_user)
  returning id into v_sale;

  -- Quantidade ou preço fora dos limites caem nas constraints (INVALID_INPUT).
  insert into public.sale_items
    (store_id, sale_id, position, product_id, product_name, unit_price_cents, points, quantity)
  select v_store, v_sale, e.position, p.id, p.name,
         coalesce((e.item ->> 'unit_price_cents')::integer, p.price_cents), p.points,
         (e.item ->> 'quantity')::integer
  from jsonb_array_elements(p_items) with ordinality as e (item, position)
  join public.products p
    on p.store_id = v_store and p.id = (e.item ->> 'product_id')::uuid;

  select sum(si.unit_price_cents::bigint * si.quantity) into v_total
  from public.sale_items si
  where si.sale_id = v_sale;

  -- No máximo R$ 100.000,00 por venda (o mesmo limite do core).
  if v_total > 10000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  if p_payment_method is not null then
    insert into public.payments (store_id, customer_id, sale_id, amount_cents, method, recorded_by)
    values (v_store, p_customer_id, v_sale, v_total::integer, p_payment_method, v_user);
  end if;

  if p_customer_id is not null then
    perform private.credit_paid_sales(v_store, p_customer_id);
  end if;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operação: registrar pagamento de dívida
-- ---------------------------------------------------------------------------

-- Pagamento total ou parcial do saldo devedor do cliente. Valor acima do saldo é
-- recusado (PAYMENT_EXCEEDS_BALANCE). A linha do cliente fica travada até o fim
-- da transação, para dois pagamentos ao mesmo tempo não passarem do saldo.
create or replace function public.record_payment(
  p_customer_id uuid, p_amount_cents integer, p_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_store uuid;
  v_balance bigint;
  v_payment uuid;
begin
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  select m.store_id into v_store from public.store_members m where m.user_id = v_user;
  if v_store is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  perform 1 from public.customers c
  where c.store_id = v_store and c.id = p_customer_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_NOT_FOUND';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  select coalesce(sum(s.total_cents - s.paid_cents), 0) into v_balance
  from private.customer_sale_standing(v_store, p_customer_id) s;

  if p_amount_cents > v_balance then
    raise exception using errcode = 'P0001', message = 'PAYMENT_EXCEEDS_BALANCE';
  end if;

  insert into public.payments (store_id, customer_id, amount_cents, method, recorded_by)
  values (v_store, p_customer_id, p_amount_cents, p_method, v_user)
  returning id into v_payment;

  perform private.credit_paid_sales(v_store, p_customer_id);

  return v_payment;
end;
$$;

