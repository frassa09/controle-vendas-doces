-- Vendas, itens e pagamentos.
--
-- Itens guardam cópia do nome, do preço cobrado e dos pontos do produto no momento
-- da venda: editar o catálogo depois não muda o histórico. Venda e pagamento
-- registram o membro (recorded_by) e a hora pelo relógio do banco. Nada é gravado
-- direto pelo app: as tabelas só têm grant de select, e a gravação passa pela
-- função record_sale, que monta venda, itens e pagamento numa transação.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  -- Nulo em venda avulsa.
  customer_id uuid,
  -- Sem FK para auth.users: o histórico sobrevive à exclusão da conta do membro.
  recorded_by uuid not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint sales_store_id_id_key unique (store_id, id),
  constraint sales_customer_fkey foreign key (store_id, customer_id)
    references public.customers (store_id, id),
  constraint sales_status_valid check (status in ('active', 'cancelled'))
);

comment on table public.sales is 'Uma venda. customer_id nulo = venda avulsa.';
comment on column public.sales.recorded_by is 'Membro (auth.users.id) que registrou a venda.';

create index sales_store_id_created_at_idx on public.sales (store_id, created_at desc);
create index sales_customer_idx on public.sales (store_id, customer_id)
  where customer_id is not null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  sale_id uuid not null,
  -- Ordem em que o item entrou na venda.
  position smallint not null,
  product_id uuid not null,
  -- Cópias do momento da venda.
  product_name text not null,
  unit_price_cents integer not null,
  points integer not null,
  quantity integer not null,
  constraint sale_items_sale_fkey foreign key (store_id, sale_id)
    references public.sales (store_id, id) on delete cascade,
  constraint sale_items_product_fkey foreign key (store_id, product_id)
    references public.products (store_id, id),
  constraint sale_items_position_key unique (sale_id, position),
  constraint sale_items_quantity_valid check (quantity between 1 and 999),
  constraint sale_items_price_valid check (unit_price_cents between 1 and 1000000),
  constraint sale_items_points_valid check (points between 0 and 9999)
);

comment on table public.sale_items is 'Itens da venda, com cópia do preço cobrado e dos pontos do produto.';
comment on column public.sale_items.unit_price_cents is 'Preço unitário efetivamente cobrado (pode diferir do preço padrão).';
comment on column public.sale_items.points is 'Pontos por unidade do produto no momento da venda.';

create index sale_items_store_id_idx on public.sale_items (store_id);
create index sale_items_sale_idx on public.sale_items (sale_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  -- Nulo só no pagamento de venda avulsa.
  customer_id uuid,
  -- Venda paga na hora que gerou o pagamento; pagamento posterior de dívida não tem.
  sale_id uuid,
  amount_cents integer not null,
  method text not null,
  recorded_by uuid not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint payments_store_id_id_key unique (store_id, id),
  constraint payments_customer_fkey foreign key (store_id, customer_id)
    references public.customers (store_id, id),
  constraint payments_sale_fkey foreign key (store_id, sale_id)
    references public.sales (store_id, id),
  constraint payments_amount_valid check (amount_cents > 0),
  constraint payments_method_valid check (method in ('pix', 'cash')),
  constraint payments_status_valid check (status in ('active', 'cancelled')),
  constraint payments_payer_valid check (customer_id is not null or sale_id is not null)
);

comment on table public.payments is 'Pagamento recebido (Pix ou dinheiro).';
comment on column public.payments.sale_id is 'Venda paga na hora que gerou este pagamento.';
comment on column public.payments.recorded_by is 'Membro (auth.users.id) que registrou o pagamento.';

create index payments_store_id_idx on public.payments (store_id);
create index payments_sale_idx on public.payments (sale_id) where sale_id is not null;
create index payments_customer_idx on public.payments (store_id, customer_id)
  where customer_id is not null;

-- ---------------------------------------------------------------------------
-- RLS e grants: membros só leem; gravação só pelas funções.
-- ---------------------------------------------------------------------------

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;

create policy sales_select_member on public.sales
  for select to authenticated
  using (store_id in (select private.my_store_ids()));

create policy sale_items_select_member on public.sale_items
  for select to authenticated
  using (store_id in (select private.my_store_ids()));

create policy payments_select_member on public.payments
  for select to authenticated
  using (store_id in (select private.my_store_ids()));

revoke all on public.sales from anon, authenticated;
revoke all on public.sale_items from anon, authenticated;
revoke all on public.payments from anon, authenticated;

grant select on public.sales to authenticated;
grant select on public.sale_items to authenticated;
grant select on public.payments to authenticated;

-- ---------------------------------------------------------------------------
-- Operação: registrar venda paga na hora
-- ---------------------------------------------------------------------------

-- p_items: [{ "product_id": uuid, "quantity": int, "unit_price_cents": int | null }]
-- (preço nulo = preço padrão atual do produto). p_payment_method: 'pix' | 'cash'.
-- security definer porque as tabelas não têm grant de insert: assim recorded_by,
-- created_at e as cópias de nome, preço e pontos não podem ser forjados pelo app.
create function public.record_sale(p_customer_id uuid, p_items jsonb, p_payment_method text)
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

  insert into public.payments (store_id, customer_id, sale_id, amount_cents, method, recorded_by)
  values (v_store, p_customer_id, v_sale, v_total::integer, p_payment_method, v_user);

  return v_sale;
end;
$$;

revoke execute on function public.record_sale(uuid, jsonb, text) from public, anon;
grant execute on function public.record_sale(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Operação: membros da loja (para mostrar quem registrou)
-- ---------------------------------------------------------------------------

-- security definer para ler o e-mail em auth.users, só dos membros da própria loja.
create function public.list_store_members()
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text
  from public.store_members m
  join auth.users u on u.id = m.user_id
  where m.store_id in (select private.my_store_ids())
  order by m.created_at
$$;

revoke execute on function public.list_store_members() from public, anon;
grant execute on function public.list_store_members() to authenticated;
