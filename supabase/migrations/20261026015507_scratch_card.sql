-- Raspadinha pela página do cliente.
--
-- * stores.scratch_cost (padrão 5) e stores.scratch_win_percent (padrão 10%):
--   custo e chance de prêmio de cada jogada, configuráveis pela loja.
-- * public.scratch_plays: a jogada (cliente, formato, se ganhou, custo e chance da
--   hora). Imutável: sem grants de escrita e trigger que recusa update/delete.
-- * points_ledger ganha o kind 'scratch' (débito de uma jogada, ligado a ela por
--   scratch_play_id). Kind próprio em vez de 'redemption' para o extrato e as
--   métricas separarem troca direta de raspadinha, e para cada débito apontar a
--   jogada que pagou (no máximo um débito por jogada).
-- * public.play_scratch: token + PIN + formato → vence pontos, confere o saldo,
--   debita, sorteia no banco (gen_random_bytes, aleatoriedade criptográfica) e grava
--   a jogada numa transação, antes de responder. Os dois formatos usam a mesma
--   chance: o formato só é guardado para a encenação.
-- * public.claim_scratch_prize: token + PIN + jogada ganha + produto-prêmio → cupom
--   (origin 'scratch', coupons.scratch_play_id único: um cupom por jogada).
-- * get_customer_page lê o custo configurado e devolve as jogadas ganhas ainda sem
--   prêmio escolhido (o cliente pode fechar a página antes de escolher).
--
-- Como no resgate direto, erro de negócio nas funções da página é
-- jsonb {error: '<CÓDIGO>'}, nunca raise (a falha de PIN gravada tem de ficar).

-- Configuração ------------------------------------------------------------------------

alter table public.stores
  add column scratch_cost integer not null default 5,
  add column scratch_win_percent integer not null default 10,
  add constraint stores_scratch_cost_valid check (scratch_cost between 1 and 1000),
  add constraint stores_scratch_win_percent_valid check (scratch_win_percent between 0 and 100);

comment on column public.stores.scratch_cost is 'Pontos de uma jogada da raspadinha. Padrão 5.';
comment on column public.stores.scratch_win_percent is 'Chance de prêmio por jogada, em % (0 a 100). Padrão 10.';

grant update (scratch_cost, scratch_win_percent) on public.stores to authenticated;

-- Jogadas ------------------------------------------------------------------------------

create table public.scratch_plays (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  customer_id uuid not null,
  -- 5 casinhas ou 3 iguais: só a encenação; a chance é a mesma.
  format text not null,
  won boolean not null,
  -- Pontos debitados e chance usada no sorteio, copiados da loja na hora.
  cost integer not null,
  win_percent integer not null,
  created_at timestamptz not null default now(),
  constraint scratch_plays_store_id_key unique (store_id, id),
  constraint scratch_plays_customer_fkey foreign key (store_id, customer_id)
    references public.customers (store_id, id),
  constraint scratch_plays_format_valid check (format in ('five_spots', 'match_three')),
  constraint scratch_plays_cost_valid check (cost > 0),
  constraint scratch_plays_win_percent_valid check (win_percent between 0 and 100)
);

comment on table public.scratch_plays is 'Jogadas da raspadinha, sorteadas no servidor. Imutáveis.';

create index scratch_plays_store_id_idx on public.scratch_plays (store_id);
create index scratch_plays_customer_idx on public.scratch_plays (store_id, customer_id, created_at);

alter table public.scratch_plays enable row level security;

create policy scratch_plays_select_member on public.scratch_plays
  for select to authenticated
  using (store_id in (select private.my_store_ids()));

revoke all on public.scratch_plays from anon, authenticated;
grant select on public.scratch_plays to authenticated;

create function private.scratch_plays_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'FORBIDDEN';
end;
$$;

create trigger scratch_plays_immutable
  before update or delete on public.scratch_plays
  for each row execute function private.scratch_plays_immutable();

-- Débito no livro de pontos -------------------------------------------------------------

alter table public.points_ledger
  add column scratch_play_id uuid,
  add constraint points_ledger_scratch_play_fkey foreign key (store_id, scratch_play_id)
    references public.scratch_plays (store_id, id),
  drop constraint points_ledger_kind_valid,
  add constraint points_ledger_kind_valid
    check (kind in ('sale_credit', 'sale_reversal', 'sale_adjustment', 'redemption', 'expiration', 'scratch')),
  add constraint points_ledger_scratch_valid
    check ((kind = 'scratch') = (scratch_play_id is not null)
           and (kind <> 'scratch' or (sale_id is null and points < 0)));

create unique index points_ledger_scratch_play_key on public.points_ledger (scratch_play_id)
  where scratch_play_id is not null;

-- Cupom da raspadinha -------------------------------------------------------------------

alter table public.coupons
  add column scratch_play_id uuid,
  add constraint coupons_scratch_play_fkey foreign key (store_id, scratch_play_id)
    references public.scratch_plays (store_id, id),
  add constraint coupons_scratch_play_key unique (scratch_play_id),
  add constraint coupons_scratch_play_valid
    check ((origin = 'scratch') = (scratch_play_id is not null));

-- Sorteio --------------------------------------------------------------------------------

-- true com probabilidade p_percent/100, a partir de 32 bits do gerador criptográfico
-- do banco (pgcrypto). 0 nunca ganha; 100 sempre ganha.
create function private.draw_scratch(p_percent integer)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_value bigint;
begin
  v_value := ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint;
  -- v_value é uniforme em [0, 2^32): ganha se cair na fração p_percent/100 do intervalo.
  return v_value * 100 < p_percent::bigint * 4294967296;
end;
$$;

revoke execute on function private.draw_scratch(integer) from public, anon, authenticated;

-- Joga a raspadinha. Ordem das checagens: token, formato, PIN (com limite de
-- tentativas), prêmios disponíveis, saldo. Devolve
-- {play: {id, format, won, createdAt}, balance} ou {error, ...}:
-- LINK_NOT_FOUND, INVALID_INPUT, PIN_INVALID {attemptsLeft}, PIN_LOCKED {lockedUntil},
-- NO_PRIZES_AVAILABLE, INSUFFICIENT_POINTS {balance, cost}.
create function public.play_scratch(p_token text, p_pin text, p_format text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
  v_pin_error jsonb;
  v_store public.stores;
  v_balance bigint;
  v_play public.scratch_plays;
begin
  v_customer := private.lock_customer_by_token(p_token);
  if v_customer.id is null then
    return jsonb_build_object('error', 'LINK_NOT_FOUND');
  end if;

  if p_format is null or p_format not in ('five_spots', 'match_three') then
    return jsonb_build_object('error', 'INVALID_INPUT');
  end if;

  v_pin_error := private.verify_customer_pin(v_customer.id, p_pin);
  if v_pin_error is not null then
    return v_pin_error;
  end if;

  -- Sem produto-prêmio não há o que ganhar: não cobra a jogada.
  if not exists (
    select 1 from public.products p
    where p.store_id = v_customer.store_id and p.is_active and p.can_be_prize
  ) then
    return jsonb_build_object('error', 'NO_PRIZES_AVAILABLE');
  end if;

  select * into v_store from public.stores s where s.id = v_customer.store_id;
  -- Pontos vencidos saem do saldo antes da jogada (validade dos pontos).
  perform private.expire_customer_points(v_customer.store_id, v_customer.id);
  v_balance := private.customer_points_balance(v_customer.store_id, v_customer.id);
  if v_balance < v_store.scratch_cost then
    return jsonb_build_object(
      'error', 'INSUFFICIENT_POINTS', 'balance', v_balance, 'cost', v_store.scratch_cost
    );
  end if;

  insert into public.scratch_plays (store_id, customer_id, format, won, cost, win_percent)
  values (
    v_customer.store_id, v_customer.id, p_format,
    private.draw_scratch(v_store.scratch_win_percent),
    v_store.scratch_cost, v_store.scratch_win_percent
  )
  returning * into v_play;

  insert into public.points_ledger (store_id, customer_id, kind, points, scratch_play_id)
  values (v_customer.store_id, v_customer.id, 'scratch', -v_play.cost, v_play.id);

  return jsonb_build_object(
    'play', jsonb_build_object(
      'id', v_play.id,
      'format', v_play.format,
      'won', v_play.won,
      'createdAt', v_play.created_at
    ),
    'balance', v_balance - v_play.cost
  );
end;
$$;

revoke execute on function public.play_scratch(text, text, text) from public, anon, authenticated;
grant execute on function public.play_scratch(text, text, text) to service_role;

-- Escolhe o prêmio de uma jogada ganha. Ordem: token, PIN, jogada (do cliente e
-- ganha), prêmio ainda não escolhido, produto (ativo e marcado como prêmio da loja).
-- Devolve {coupon} ou {error, ...}: LINK_NOT_FOUND, PIN_INVALID, PIN_LOCKED,
-- SCRATCH_PLAY_NOT_FOUND, PRIZE_ALREADY_CLAIMED, PRIZE_NOT_AVAILABLE.
create function public.claim_scratch_prize(
  p_token text, p_pin text, p_play_id uuid, p_product_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
  v_pin_error jsonb;
  v_play public.scratch_plays;
  v_product public.products;
  v_coupon public.coupons;
begin
  v_customer := private.lock_customer_by_token(p_token);
  if v_customer.id is null then
    return jsonb_build_object('error', 'LINK_NOT_FOUND');
  end if;

  v_pin_error := private.verify_customer_pin(v_customer.id, p_pin);
  if v_pin_error is not null then
    return v_pin_error;
  end if;

  select * into v_play from public.scratch_plays sp
  where sp.store_id = v_customer.store_id and sp.customer_id = v_customer.id
    and sp.id = p_play_id and sp.won;
  if not found then
    return jsonb_build_object('error', 'SCRATCH_PLAY_NOT_FOUND');
  end if;

  if exists (select 1 from public.coupons c where c.scratch_play_id = v_play.id) then
    return jsonb_build_object('error', 'PRIZE_ALREADY_CLAIMED');
  end if;

  select * into v_product from public.products p
  where p.store_id = v_customer.store_id and p.id = p_product_id
    and p.is_active and p.can_be_prize;
  if not found then
    return jsonb_build_object('error', 'PRIZE_NOT_AVAILABLE');
  end if;

  insert into public.coupons
    (store_id, customer_id, product_id, product_name, origin, scratch_play_id)
  values
    (v_customer.store_id, v_customer.id, v_product.id, v_product.name, 'scratch', v_play.id)
  returning * into v_coupon;

  return jsonb_build_object(
    'coupon', jsonb_build_object(
      'id', v_coupon.id,
      'productName', v_coupon.product_name,
      'origin', v_coupon.origin,
      'createdAt', v_coupon.created_at
    )
  );
end;
$$;

revoke execute on function public.claim_scratch_prize(text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_scratch_prize(text, text, uuid, uuid) to service_role;

-- Página do cliente -------------------------------------------------------------------
-- Igual à do resgate direto, mais: custo da raspadinha configurado e jogadas ganhas
-- sem prêmio escolhido. Débitos da raspadinha ficam fora dos pontos dos recadinhos,
-- como os do resgate.

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
  v_open jsonb;
  v_history jsonb;
  v_prizes jsonb;
  v_coupons jsonb;
  v_wins jsonb;
  v_expires timestamptz;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select * into v_customer from public.customers c where c.link_token = p_token;
  if not found then
    return null;
  end if;

  select * into v_store from public.stores s where s.id = v_customer.store_id;

  -- Vence os pontos antes de ler o saldo (a leitura é o gatilho do vencimento).
  v_expires := private.expire_customer_points(v_customer.store_id, v_customer.id);
  v_points := private.customer_points_balance(v_customer.store_id, v_customer.id);

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
                         and l.kind not in ('redemption', 'scratch')
                         and (l.sale_id is null
                              or (select sum(k.points) from public.points_ledger k
                                   where k.sale_id = l.sale_id) > 0))
         ) order by e.created_at desc, e.id desc), '[]'::jsonb)
  into v_history
  from events e;

  -- Produtos que o cliente pode escolher como prêmio (ativos e marcados).
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name)
           order by p.name, p.id), '[]'::jsonb)
  into v_prizes
  from public.products p
  where p.store_id = v_customer.store_id and p.is_active and p.can_be_prize;

  -- Cupons ainda não entregues, do mais antigo para o mais novo.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'productName', c.product_name,
           'origin', c.origin,
           'createdAt', c.created_at
         ) order by c.created_at, c.id), '[]'::jsonb)
  into v_coupons
  from public.coupons c
  where c.store_id = v_customer.store_id and c.customer_id = v_customer.id
    and c.status = 'pending';

  -- Jogadas ganhas cujo prêmio ainda não foi escolhido, da mais antiga para a mais nova.
  select coalesce(jsonb_agg(jsonb_build_object('playId', sp.id, 'createdAt', sp.created_at)
           order by sp.created_at, sp.id), '[]'::jsonb)
  into v_wins
  from public.scratch_plays sp
  where sp.store_id = v_customer.store_id and sp.customer_id = v_customer.id and sp.won
    and not exists (select 1 from public.coupons c where c.scratch_play_id = sp.id);

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
    'redeemCost', v_store.redeem_cost,
    'scratchCost', v_store.scratch_cost,
    'prizes', v_prizes,
    'coupons', v_coupons,
    'unclaimedScratchWins', v_wins,
    'openSales', v_open,
    'history', v_history
  );
end;
$$;
