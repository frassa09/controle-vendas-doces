-- Loja e membros: a base do isolamento multi-loja.
--
-- Padrão que toda tabela de negócio segue a partir daqui:
--   * coluna store_id not null referenciando public.stores, com índice;
--   * RLS habilitado na mesma migração que cria a tabela;
--   * políticas "to authenticated" que comparam store_id com private.my_store_ids();
--   * grants explícitos (nada de depender dos default privileges do Supabase);
--   * operações com mais de uma linha ou que precisam furar o RLS ficam em funções
--     (RPC). Toda função criada em public tem o EXECUTE revogado de public/anon e
--     concedido só a quem precisa.

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pix_key text not null,
  city text not null,
  created_at timestamptz not null default now(),
  constraint stores_name_valid check (name = btrim(name) and char_length(name) between 1 and 80),
  constraint stores_pix_key_valid check (pix_key = btrim(pix_key) and char_length(pix_key) between 1 and 77),
  constraint stores_city_valid check (city = btrim(city) and char_length(city) between 1 and 60)
);

comment on table public.stores is 'Uma loja. Todo dado de negócio pertence a exatamente uma loja.';
comment on column public.stores.pix_key is 'Chave Pix usada no Pix copia-e-cola (no máximo 77 caracteres, limite do BR Code).';
comment on column public.stores.city is 'Cidade do recebedor, exigida pelo padrão do Pix copia-e-cola.';

create table public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

comment on table public.store_members is 'Associação usuário–loja. Todos os membros têm as mesmas permissões.';

-- Na v1 cada usuário pertence a no máximo uma loja ("obter minha loja" é único).
-- O índice único também serve às consultas por user_id feitas pelo RLS.
create unique index store_members_one_store_per_user on public.store_members (user_id);

-- ---------------------------------------------------------------------------
-- Função base do RLS
-- ---------------------------------------------------------------------------

-- security definer: lê store_members sem passar pelo RLS dela, o que evita a
-- recursão infinita de uma política de store_members consultando a si mesma.
create function private.my_store_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.store_id from public.store_members m where m.user_id = (select auth.uid())
$$;

revoke execute on function private.my_store_ids() from public, anon;
grant execute on function private.my_store_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.stores enable row level security;

create policy stores_select_member on public.stores
  for select to authenticated
  using (id in (select private.my_store_ids()));

create policy stores_update_member on public.stores
  for update to authenticated
  using (id in (select private.my_store_ids()))
  with check (id in (select private.my_store_ids()));

-- Sem política de insert/delete: lojas nascem por public.create_store e não são apagadas.

alter table public.store_members enable row level security;

create policy store_members_select_member on public.store_members
  for select to authenticated
  using (store_id in (select private.my_store_ids()));

-- Sem política de insert/update/delete: associações nascem por RPC
-- (create_store agora; entrar com convite depois).

-- ---------------------------------------------------------------------------
-- Grants (verificados antes do RLS). anon não recebe nada.
-- ---------------------------------------------------------------------------

revoke all on public.stores from anon, authenticated;
revoke all on public.store_members from anon, authenticated;

grant select, update (name, pix_key, city) on public.stores to authenticated;
grant select on public.store_members to authenticated;

-- ---------------------------------------------------------------------------
-- Operação: criar loja
-- ---------------------------------------------------------------------------

-- Cria a loja e torna o usuário atual seu membro, numa única transação.
-- security definer porque o criador ainda não é membro (o RLS barraria o insert).
-- Erros de negócio: errcode P0001 com a mensagem igual ao código do erro.
create function public.create_store(p_name text, p_pix_key text, p_city text)
returns public.stores
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_store public.stores;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  if exists (select 1 from public.store_members m where m.user_id = v_user_id) then
    raise exception using errcode = 'P0001', message = 'ALREADY_HAS_STORE';
  end if;

  insert into public.stores (name, pix_key, city)
  values (btrim(p_name), btrim(p_pix_key), btrim(p_city))
  returning * into v_store;

  insert into public.store_members (store_id, user_id) values (v_store.id, v_user_id);

  return v_store;
end;
$$;

revoke execute on function public.create_store(text, text, text) from public, anon;
grant execute on function public.create_store(text, text, text) to authenticated;
