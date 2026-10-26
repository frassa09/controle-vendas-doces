-- Resgate direto pela página do cliente e cupons.
--
-- * stores.redeem_cost: pontos de um resgate direto (padrão 10), configurável.
-- * private.pin_attempts + private.verify_customer_pin: PIN de 4 dígitos com
--   bloqueio temporário depois de falhas seguidas. Reaproveitado pela raspadinha.
-- * public.coupons: prêmio pendente até um membro entregar (deliver_coupon).
-- * public.redeem_reward: token + PIN + produto-prêmio → débito no livro de pontos
--   (kind 'redemption') e cupom, numa transação. Só a service role executa (a
--   página chama pela edge function customer-redeem).
-- * get_customer_page passa a ler o custo configurado e mostra prêmios e cupons.
--
-- Funções chamadas pela página NÃO levantam exceção para erro de negócio: devolvem
-- jsonb {error: '<CÓDIGO>', ...}. Assim a falha de PIN registrada em pin_attempts
-- não é desfeita junto com a transação.

-- Custo do resgate direto ------------------------------------------------------

alter table public.stores
  add column redeem_cost integer not null default 10,
  add constraint stores_redeem_cost_valid check (redeem_cost between 1 and 1000);

comment on column public.stores.redeem_cost is 'Pontos de um resgate direto (produto grátis). Padrão 10.';

grant update (redeem_cost) on public.stores to authenticated;

-- PIN com bloqueio por tentativas ------------------------------------------------

-- Uma linha por cliente que já errou o PIN. Fica em private: nada da API a enxerga.
create table private.pin_attempts (
  customer_id uuid primary key references public.customers (id) on delete cascade,
  -- Falhas seguidas dentro da janela (zera no acerto, no bloqueio e quando a última
  -- falha fica mais velha que a janela).
  failures integer not null default 0,
  last_failure_at timestamptz,
  locked_until timestamptz
);

comment on table private.pin_attempts is 'Falhas de PIN da página do cliente: 5 seguidas em 15 min bloqueiam por 15 min.';

revoke all on private.pin_attempts from public, anon, authenticated;

-- O cliente dono do token, com a linha travada (serializa resgates e jogadas do
-- mesmo cliente: saldo e tentativas não correm em paralelo). Linha nula se não há.
create function private.lock_customer_by_token(p_token text)
returns public.customers
language plpgsql
set search_path = ''
as $$
declare
  v_customer public.customers;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into v_customer from public.customers c where c.link_token = p_token for update;
  return v_customer;
end;
$$;

-- Confere o PIN do cliente com o limite de tentativas. Devolve null quando o PIN
-- está certo; senão {error: 'PIN_INVALID', attemptsLeft} ou
-- {error: 'PIN_LOCKED', lockedUntil}. Durante o bloqueio nem o PIN certo passa.
-- A gravação da falha precisa sobreviver: quem chama não pode levantar exceção
-- depois de um retorno não nulo.
create function private.verify_customer_pin(p_customer_id uuid, p_pin text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  c_max_failures constant integer := 5;
  c_window constant interval := interval '15 minutes';
  v_pin text;
  v_attempt private.pin_attempts;
  v_failures integer;
  v_locked_until timestamptz;
begin
  select c.pin into v_pin from public.customers c where c.id = p_customer_id;

  insert into private.pin_attempts (customer_id) values (p_customer_id)
  on conflict (customer_id) do nothing;
  select * into v_attempt from private.pin_attempts a
  where a.customer_id = p_customer_id for update;

  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return jsonb_build_object('error', 'PIN_LOCKED', 'lockedUntil', v_attempt.locked_until);
  end if;

  if p_pin is not null and v_pin is not null and p_pin = v_pin then
    update private.pin_attempts
    set failures = 0, last_failure_at = null, locked_until = null
    where customer_id = p_customer_id;
    return null;
  end if;

  v_failures := case
    when v_attempt.last_failure_at is null or v_attempt.last_failure_at < now() - c_window then 1
    else v_attempt.failures + 1
  end;

  if v_failures >= c_max_failures then
    v_locked_until := now() + c_window;
    update private.pin_attempts
    set failures = 0, last_failure_at = null, locked_until = v_locked_until
    where customer_id = p_customer_id;
    return jsonb_build_object('error', 'PIN_LOCKED', 'lockedUntil', v_locked_until);
  end if;

  update private.pin_attempts
  set failures = v_failures, last_failure_at = now(), locked_until = null
  where customer_id = p_customer_id;
  return jsonb_build_object('error', 'PIN_INVALID', 'attemptsLeft', c_max_failures - v_failures);
end;
$$;

-- Saldo de pontos do cliente (soma do livro; pode ser negativo).
create function private.customer_points_balance(p_store_id uuid, p_customer_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(l.points), 0)::bigint
  from public.points_ledger l
  where l.store_id = p_store_id and l.customer_id = p_customer_id;
$$;

revoke execute on function private.lock_customer_by_token(text) from public, anon, authenticated;
revoke execute on function private.verify_customer_pin(uuid, text) from public, anon, authenticated;
revoke execute on function private.customer_points_balance(uuid, uuid) from public, anon, authenticated;

-- Cupons -------------------------------------------------------------------------

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  customer_id uuid not null,
  product_id uuid not null,
  -- Cópia do nome na hora do prêmio (o produto pode mudar depois).
  product_name text not null,
  -- De onde veio: resgate direto ou raspadinha (ticket da raspadinha).
  origin text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  -- Sem FK, como recorded_by: o histórico sobrevive à exclusão da conta.
  delivered_by uuid,
  constraint coupons_store_id_key unique (store_id, id),
  constraint coupons_customer_fkey foreign key (store_id, customer_id)
    references public.customers (store_id, id),
  constraint coupons_product_fkey foreign key (store_id, product_id)
    references public.products (store_id, id),
  constraint coupons_origin_valid check (origin in ('redemption', 'scratch')),
  constraint coupons_status_valid check (status in ('pending', 'delivered')),
  constraint coupons_delivery_valid check (
    (status = 'pending' and delivered_at is null and delivered_by is null)
    or (status = 'delivered' and delivered_at is not null and delivered_by is not null)
  )
);

comment on table public.coupons is 'Prêmio do cliente (resgate direto ou raspadinha), pendente até a entrega.';

create index coupons_store_id_idx on public.coupons (store_id);
create index coupons_pending_idx on public.coupons (store_id, created_at) where status = 'pending';
create index coupons_customer_idx on public.coupons (store_id, customer_id, created_at);

alter table public.coupons enable row level security;

create policy coupons_select_member on public.coupons
  for select to authenticated
  using (store_id in (select private.my_store_ids()));

revoke all on public.coupons from anon, authenticated;
grant select on public.coupons to authenticated;

-- Dá baixa no cupom: registra quem entregou e quando.
-- Erros: NOT_AUTHENTICATED, FORBIDDEN, COUPON_NOT_FOUND, COUPON_ALREADY_DELIVERED.
create function public.deliver_coupon(p_coupon_id uuid)
returns public.coupons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_store uuid;
  v_coupon public.coupons;
begin
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  select m.store_id into v_store from public.store_members m where m.user_id = v_user;
  if v_store is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  select * into v_coupon from public.coupons c
  where c.store_id = v_store and c.id = p_coupon_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'COUPON_NOT_FOUND';
  end if;
  if v_coupon.status = 'delivered' then
    raise exception using errcode = 'P0001', message = 'COUPON_ALREADY_DELIVERED';
  end if;

  update public.coupons
  set status = 'delivered', delivered_at = now(), delivered_by = v_user
  where id = p_coupon_id
  returning * into v_coupon;
  return v_coupon;
end;
$$;

revoke execute on function public.deliver_coupon(uuid) from public, anon;
grant execute on function public.deliver_coupon(uuid) to authenticated;

-- Resgate direto -------------------------------------------------------------------

-- Troca os pontos do cliente por um produto-prêmio. Ordem das checagens: token,
-- PIN (com limite de tentativas), produto (ativo e marcado como prêmio da mesma
-- loja), saldo. Devolve {coupon, balance} ou {error, ...}:
-- LINK_NOT_FOUND, PIN_INVALID {attemptsLeft}, PIN_LOCKED {lockedUntil},
-- PRIZE_NOT_AVAILABLE, INSUFFICIENT_POINTS {balance, cost}.
create function public.redeem_reward(p_token text, p_pin text, p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
  v_pin_error jsonb;
  v_product public.products;
  v_cost integer;
  v_balance bigint;
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

  select * into v_product from public.products p
  where p.store_id = v_customer.store_id and p.id = p_product_id
    and p.is_active and p.can_be_prize;
  if not found then
    return jsonb_build_object('error', 'PRIZE_NOT_AVAILABLE');
  end if;

  select s.redeem_cost into v_cost from public.stores s where s.id = v_customer.store_id;
  v_balance := private.customer_points_balance(v_customer.store_id, v_customer.id);
  if v_balance < v_cost then
    return jsonb_build_object('error', 'INSUFFICIENT_POINTS', 'balance', v_balance, 'cost', v_cost);
  end if;

  insert into public.coupons (store_id, customer_id, product_id, product_name, origin)
  values (v_customer.store_id, v_customer.id, v_product.id, v_product.name, 'redemption')
  returning * into v_coupon;

  insert into public.points_ledger (store_id, customer_id, kind, points)
  values (v_customer.store_id, v_customer.id, 'redemption', -v_cost);

  return jsonb_build_object(
    'coupon', jsonb_build_object(
      'id', v_coupon.id,
      'productName', v_coupon.product_name,
      'origin', v_coupon.origin,
      'createdAt', v_coupon.created_at
    ),
    'balance', v_balance - v_cost
  );
end;
$$;

revoke execute on function public.redeem_reward(text, text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_reward(text, text, uuid) to service_role;

-- Página do cliente -------------------------------------------------------------------
-- Igual à da correção de vendas, mais: custo do resgate configurado, prêmios que
-- podem ser escolhidos e cupons pendentes. O custo da raspadinha continua fixo até
-- o ticket da raspadinha.

create or replace function public.get_customer_page(p_token text)
returns jsonb
language plpgsql
stable
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
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select * into v_customer from public.customers c where c.link_token = p_token;
  if not found then
    return null;
  end if;

  select * into v_store from public.stores s where s.id = v_customer.store_id;

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
                         and l.kind <> 'redemption'
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
    'redeemCost', v_store.redeem_cost,
    -- Fixo até o ticket da raspadinha (padrão da spec: 5 pontos).
    'scratchCost', 5,
    'prizes', v_prizes,
    'coupons', v_coupons,
    'openSales', v_open,
    'history', v_history
  );
end;
$$;
