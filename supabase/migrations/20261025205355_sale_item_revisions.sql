-- Versões anteriores dos itens de uma venda editada.
--
-- update_sale troca os itens da venda; antes de trocar, copia os itens atuais para
-- sale_item_revisions como uma versão numerada (1, 2, ...), com quem e quando a
-- substituiu. Assim nada do que foi registrado se perde. Quem lê a venda continua
-- lendo sale_items (a versão atual). Gravação só pela função; o app só lê.

create table public.sale_item_revisions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  sale_id uuid not null,
  -- 1 = os itens como foram registrados; cada edição guarda a versão que substituiu.
  revision integer not null,
  -- Quando e por quem esta versão foi substituída.
  replaced_at timestamptz not null default now(),
  replaced_by uuid not null,
  position smallint not null,
  product_id uuid not null,
  product_name text not null,
  unit_price_cents integer not null,
  points integer not null,
  quantity integer not null,
  constraint sale_item_revisions_sale_fkey foreign key (store_id, sale_id)
    references public.sales (store_id, id),
  constraint sale_item_revisions_position_key unique (sale_id, revision, position),
  constraint sale_item_revisions_revision_valid check (revision >= 1)
);

comment on table public.sale_item_revisions is
  'Itens de versões anteriores de uma venda editada (cópia feita por update_sale).';
comment on column public.sale_item_revisions.replaced_by is
  'Membro (auth.users.id) que editou a venda e substituiu esta versão.';

create index sale_item_revisions_store_id_idx on public.sale_item_revisions (store_id);
create index sale_item_revisions_sale_idx on public.sale_item_revisions (sale_id, revision);

alter table public.sale_item_revisions enable row level security;

create policy sale_item_revisions_select_member on public.sale_item_revisions
  for select to authenticated
  using (store_id in (select private.my_store_ids()));

revoke all on public.sale_item_revisions from anon, authenticated;
grant select on public.sale_item_revisions to authenticated;

-- ---------------------------------------------------------------------------
-- update_sale passa a guardar a versão anterior antes de trocar os itens
-- ---------------------------------------------------------------------------

create or replace function public.update_sale(p_sale_id uuid, p_items jsonb)
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
  v_revision integer;
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

  -- Guarda a versão atual antes de trocá-la (a venda está travada: número sem disputa).
  select coalesce(max(r.revision), 0) + 1 into v_revision
  from public.sale_item_revisions r where r.sale_id = p_sale_id;

  insert into public.sale_item_revisions
    (store_id, sale_id, revision, replaced_by, position, product_id, product_name,
     unit_price_cents, points, quantity)
  select v_store, p_sale_id, v_revision, v_user, i.position, i.product_id, i.product_name,
         i.unit_price_cents, i.points, i.quantity
  from public.sale_items i where i.sale_id = p_sale_id;

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
