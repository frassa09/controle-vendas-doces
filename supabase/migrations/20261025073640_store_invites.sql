-- Convite do segundo membro: o dono gera um código de uso único e a outra pessoa,
-- já com conta e ainda sem loja, entra na mesma loja digitando o código.
--
-- Cada loja tem no máximo um código ainda não usado: gerar outro descarta o anterior.
-- Os códigos usados ficam guardados (quem usou e quando).
--
-- Quem entra vira uma linha comum de store_members: as políticas existentes
-- (private.my_store_ids) já lhe dão exatamente as mesmas permissões do dono.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------

create table public.store_invites (
  -- 8 caracteres de um alfabeto sem 0/O e 1/I, para ditar e digitar sem engano.
  code text primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  constraint store_invites_code_valid check (code ~ '^[A-HJ-NP-Z2-9]{8}$')
);

comment on table public.store_invites is 'Códigos de convite de uso único para entrar numa loja.';
comment on column public.store_invites.used_at is 'Quando o código foi usado; nulo enquanto está disponível.';

create index store_invites_store_id on public.store_invites (store_id);

-- No máximo um código disponível por loja.
create unique index store_invites_one_open_per_store on public.store_invites (store_id)
  where used_at is null;

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------

alter table public.store_invites enable row level security;

create policy store_invites_select_member on public.store_invites
  for select to authenticated
  using (store_id in (select private.my_store_ids()));

-- Sem política de insert/update/delete: códigos nascem e são usados só pelas RPCs.

revoke all on public.store_invites from anon, authenticated;
grant select on public.store_invites to authenticated;

-- ---------------------------------------------------------------------------
-- Operação: gerar código de convite
-- ---------------------------------------------------------------------------

-- Gera um novo código para a loja de quem chama, descartando o código ainda não
-- usado que existir. security definer porque não há grant de insert/delete.
create function public.create_store_invite()
returns public.store_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_store_id uuid;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  v_invite public.store_invites;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  select m.store_id into v_store_id from public.store_members m where m.user_id = v_user_id;
  if v_store_id is null then
    raise exception using errcode = '42501', message = 'not a store member';
  end if;

  -- Serializa gerações simultâneas da mesma loja.
  perform 1 from public.stores s where s.id = v_store_id for update;

  delete from public.store_invites i where i.store_id = v_store_id and i.used_at is null;

  for attempt in 1..5 loop
    -- 32 símbolos: o resto da divisão de um byte por 32 não tem viés.
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;

    begin
      insert into public.store_invites (code, store_id, created_by)
      values (v_code, v_store_id, v_user_id)
      returning * into v_invite;
      return v_invite;
    exception when unique_violation then
      null; -- Código repetido (raríssimo): tenta outro.
    end;
  end loop;

  raise exception 'could not generate a unique invite code';
end;
$$;

revoke execute on function public.create_store_invite() from public, anon;
grant execute on function public.create_store_invite() to authenticated;

-- ---------------------------------------------------------------------------
-- Operação: entrar com convite
-- ---------------------------------------------------------------------------

-- Usa o código e torna quem chama membro da loja do código, numa única transação.
-- security definer porque quem entra ainda não é membro (não vê o convite nem a loja).
create function public.join_store_with_invite(p_code text)
returns public.stores
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_invite public.store_invites;
  v_store public.stores;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  if exists (select 1 from public.store_members m where m.user_id = v_user_id) then
    raise exception using errcode = 'P0001', message = 'ALREADY_HAS_STORE';
  end if;

  -- for update: duas pessoas com o mesmo código ao mesmo tempo, só uma entra.
  select * into v_invite from public.store_invites i where i.code = v_code for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITE_NOT_FOUND';
  end if;
  if v_invite.used_at is not null then
    raise exception using errcode = 'P0001', message = 'INVITE_ALREADY_USED';
  end if;

  update public.store_invites i
  set used_by = v_user_id, used_at = now()
  where i.code = v_invite.code;

  insert into public.store_members (store_id, user_id) values (v_invite.store_id, v_user_id);

  select * into v_store from public.stores s where s.id = v_invite.store_id;
  return v_store;
end;
$$;

revoke execute on function public.join_store_with_invite(text) from public, anon;
grant execute on function public.join_store_with_invite(text) to authenticated;
