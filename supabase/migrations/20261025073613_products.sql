-- Catálogo: produtos e combos da loja.
--
-- Combo é um produto marcado como combo, com preço e pontos próprios. Produtos
-- não são apagados: desativar tira da venda, mas o produto continua listável e
-- referenciável (itens de venda guardam cópia do preço e dos pontos).

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  price_cents integer not null,
  points integer not null default 0,
  can_be_prize boolean not null default false,
  is_active boolean not null default true,
  is_combo boolean not null default false,
  created_at timestamptz not null default now(),
  -- Alvo das FKs compostas (store_id, product_id) das próximas tabelas.
  constraint products_store_id_id_key unique (store_id, id),
  constraint products_name_valid check (name = btrim(name) and char_length(name) between 1 and 80),
  constraint products_price_valid check (price_cents between 1 and 1000000),
  constraint products_points_valid check (points between 0 and 9999)
);

comment on table public.products is 'Produtos e combos do cardápio da loja.';
comment on column public.products.price_cents is 'Preço padrão em centavos (positivo, até R$ 10.000,00).';
comment on column public.products.points is 'Pontos de fidelidade que cada unidade gera quando a venda é quitada.';
comment on column public.products.can_be_prize is 'Pode ser escolhido como prêmio (resgate direto e raspadinha).';
comment on column public.products.is_active is 'Inativo não aparece na venda, mas continua no catálogo e no histórico.';

create index products_store_id_idx on public.products (store_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.products enable row level security;

create policy products_select_member on public.products
  for select to authenticated
  using (store_id in (select private.my_store_ids()));

create policy products_insert_member on public.products
  for insert to authenticated
  with check (store_id in (select private.my_store_ids()));

create policy products_update_member on public.products
  for update to authenticated
  using (store_id in (select private.my_store_ids()))
  with check (store_id in (select private.my_store_ids()));

-- Sem política de delete: produtos não são apagados.

-- ---------------------------------------------------------------------------
-- Grants. anon não recebe nada; store_id não é atualizável.
-- ---------------------------------------------------------------------------

revoke all on public.products from anon, authenticated;

grant select on public.products to authenticated;
grant insert (store_id, name, price_cents, points, can_be_prize, is_active, is_combo)
  on public.products to authenticated;
grant update (name, price_cents, points, can_be_prize, is_active, is_combo)
  on public.products to authenticated;
