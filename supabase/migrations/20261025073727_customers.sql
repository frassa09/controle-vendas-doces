-- Clientes da loja: cadastro, busca no balcão e o token secreto do link da página.
--
-- O PIN fica legível para os membros (precisa ser reenviado ao cliente). O token
-- do link nasce no banco (pgcrypto), não é escolhido pelo app nem alterável, e
-- anon não lê nada desta tabela: a página pública vai acessá-lo só por edge function.

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  name text not null,
  -- 55 + DDD + número (celular com 9 dígitos começando com 9, ou fixo com 8).
  whatsapp text not null,
  reference text,
  notes text,
  pin text not null,
  link_token text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  consented boolean not null default false,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Alvo das FKs compostas (store_id, customer_id) de vendas, pagamentos etc.
  -- Também serve de índice por store_id (coluna inicial).
  constraint customers_store_id_id_key unique (store_id, id),
  constraint customers_link_token_key unique (link_token),
  constraint customers_name_valid check (name = btrim(name) and char_length(name) between 1 and 80),
  constraint customers_whatsapp_valid check (whatsapp ~ '^55[1-9][1-9]([2-5][0-9]{7}|9[0-9]{8})$'),
  constraint customers_reference_valid check (
    reference is null or (reference = btrim(reference) and char_length(reference) between 1 and 80)
  ),
  constraint customers_notes_valid check (
    notes is null or (notes = btrim(notes) and char_length(notes) between 1 and 500)
  ),
  constraint customers_pin_valid check (pin ~ '^[0-9]{4}$'),
  constraint customers_consent_valid check ((consent_at is not null) = consented)
);

comment on table public.customers is 'Clientes de uma loja.';
comment on column public.customers.whatsapp is 'Telefone normalizado pelo core: 55 + DDD + número, só dígitos.';
comment on column public.customers.reference is 'Onde encontrar o cliente ou apelido (entra na busca).';
comment on column public.customers.pin is 'PIN de 4 dígitos exigido pela página pública para resgatar e jogar.';
comment on column public.customers.link_token is 'Segredo do link da página do cliente. Gerado pelo banco; nunca alterado pelo app.';
comment on column public.customers.consent_at is 'Quando o cliente consentiu (LGPD). Mantido pelo trigger a partir de consented.';

-- Data do consentimento e da última alteração vêm do relógio do banco, nunca do app.
create function private.customers_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.consent_at := case when new.consented then now() end;
  else
    new.consent_at := case
      when new.consented is not distinct from old.consented then old.consent_at
      when new.consented then now()
    end;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function private.customers_before_write() from public, anon, authenticated;

create trigger customers_before_write
  before insert or update on public.customers
  for each row execute function private.customers_before_write();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.customers enable row level security;

create policy customers_select_member on public.customers
  for select to authenticated
  using (store_id in (select private.my_store_ids()));

create policy customers_insert_member on public.customers
  for insert to authenticated
  with check (store_id in (select private.my_store_ids()));

create policy customers_update_member on public.customers
  for update to authenticated
  using (store_id in (select private.my_store_ids()))
  with check (store_id in (select private.my_store_ids()));

-- Sem política de delete: clientes não são apagados na v1.

-- ---------------------------------------------------------------------------
-- Grants. anon não recebe nada. store_id, link_token e as datas não são graváveis.
-- ---------------------------------------------------------------------------

revoke all on public.customers from anon, authenticated;

grant select on public.customers to authenticated;
grant insert (store_id, name, whatsapp, reference, notes, pin, consented)
  on public.customers to authenticated;
grant update (name, whatsapp, reference, notes, pin, consented)
  on public.customers to authenticated;

-- ---------------------------------------------------------------------------
-- Operação: buscar clientes por nome ou referência
-- ---------------------------------------------------------------------------

-- Texto para comparação: minúsculo, sem acento e com espaços simples.
-- O dicionário vai qualificado porque search_path é vazio.
create function private.search_fold(p_text text)
returns text
language sql
stable
set search_path = ''
as $$
  select regexp_replace(
    btrim(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_text, '')))),
    '\s+', ' ', 'g'
  )
$$;

revoke execute on function private.search_fold(text) from public, anon;
grant execute on function private.search_fold(text) to authenticated;

-- security invoker: o RLS de customers restringe à loja de quem chama.
-- Consulta vazia lista todos os clientes, em ordem alfabética.
create function public.search_customers(p_query text)
returns setof public.customers
language sql
stable
set search_path = ''
as $$
  select c.*
  from public.customers c
  cross join (select private.search_fold(p_query) as key) q
  where q.key = ''
     or strpos(private.search_fold(c.name || ' ' || coalesce(c.reference, '')), q.key) > 0
  order by private.search_fold(c.name), c.created_at
$$;

revoke execute on function public.search_customers(text) from public, anon;
grant execute on function public.search_customers(text) to authenticated;
