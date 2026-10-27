-- Fila de cobrança: texto-modelo por loja, registro de cobranças enviadas e a
-- fila de devedores.
--
-- O saldo e a idade da dívida vêm de private.customer_sale_standing (alocação FIFO
-- do ticket de fiado); nada é recalculado aqui por outro caminho.

-- ---------------------------------------------------------------------------
-- Texto-modelo editável por loja (nulo = usa o texto padrão do core)
-- ---------------------------------------------------------------------------

alter table public.stores
  add column collection_template text,
  add constraint stores_collection_template_valid
    check (collection_template is null or char_length(collection_template) between 1 and 1500);

comment on column public.stores.collection_template is
  'Texto-modelo da mensagem de cobrança (variáveis {nome} {itens} {total} {pix} {link}). Nulo = texto padrão.';

grant update (collection_template) on public.stores to authenticated;

-- ---------------------------------------------------------------------------
-- Cobranças enviadas
-- ---------------------------------------------------------------------------

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  customer_id uuid not null,
  -- Saldo devedor no momento do envio (histórico; o saldo atual é sempre derivado).
  amount_cents integer not null check (amount_cents > 0),
  -- Sem FK: o histórico sobrevive à exclusão da conta de quem enviou.
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  foreign key (store_id, customer_id) references public.customers (store_id, id) on delete cascade
);

create index collections_store_id_idx on public.collections (store_id);
create index collections_customer_idx on public.collections (store_id, customer_id, created_at desc);

alter table public.collections enable row level security;

create policy collections_select on public.collections
  for select to authenticated
  using (store_id in (select private.my_store_ids()));

revoke all on public.collections from anon, authenticated;
grant select on public.collections to authenticated;

-- ---------------------------------------------------------------------------
-- Registrar cobrança enviada
-- ---------------------------------------------------------------------------

-- Erros: NOT_AUTHENTICATED, FORBIDDEN (sem loja), CUSTOMER_NOT_FOUND, NO_DEBT.
create function public.record_collection(p_customer_id uuid)
returns table (id uuid, amount_cents integer, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_store uuid;
  v_balance bigint;
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

  select coalesce(sum(s.total_cents - s.paid_cents), 0) into v_balance
  from private.customer_sale_standing(v_store, p_customer_id) s;

  if v_balance <= 0 then
    raise exception using errcode = 'P0001', message = 'NO_DEBT';
  end if;

  return query
    insert into public.collections as col (store_id, customer_id, amount_cents, recorded_by)
    values (v_store, p_customer_id, v_balance::integer, v_user)
    returning col.id, col.amount_cents, col.created_at;
end;
$$;

revoke execute on function public.record_collection(uuid) from public, anon;
grant execute on function public.record_collection(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Fila de cobrança: todos os devedores, da dívida mais antiga para a mais nova
-- ---------------------------------------------------------------------------

-- security invoker: o RLS limita à loja de quem chama.
create function public.list_collection_queue()
returns table (
  customer_id uuid,
  name text,
  whatsapp text,
  balance_cents bigint,
  debt_since timestamptz,
  last_collection_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select c.id, c.name, c.whatsapp, d.balance, d.since,
         (select max(col.created_at) from public.collections col
           where col.store_id = c.store_id and col.customer_id = c.id)
  from public.customers c
  cross join lateral (
    select coalesce(sum(s.total_cents - s.paid_cents), 0)::bigint as balance,
           min(s.created_at) filter (where s.total_cents > s.paid_cents) as since
    from private.customer_sale_standing(c.store_id, c.id) s
  ) d
  where d.balance > 0
  order by d.since, c.name, c.id
$$;

revoke execute on function public.list_collection_queue() from public, anon;
grant execute on function public.list_collection_queue() to authenticated;
