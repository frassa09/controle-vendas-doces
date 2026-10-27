-- Página do cliente ("o Cantinho") e identidade da loja.
--
-- Identidade: logo, cor principal e texto de boas-vindas, opcionais, editáveis por
-- qualquer membro. Sem eles a página usa a aparência padrão.
--
-- Página pública: o cliente abre o link secreto (customers.link_token) sem login.
-- anon continua sem nenhum grant; a página só lê pela edge function customer-view,
-- que chama public.get_customer_page com a service role. A função devolve apenas
-- os dados do cliente dono do token (nunca o PIN, o telefone ou as observações).
-- Saldo devedor e alocação vêm de private.customer_sale_standing (FIFO do fiado).

-- ---------------------------------------------------------------------------
-- Identidade da loja
-- ---------------------------------------------------------------------------

alter table public.stores
  add column brand_color text,
  add column welcome_text text,
  add column logo_data text,
  add constraint stores_brand_color_valid
    check (brand_color is null or brand_color ~ '^#[0-9A-F]{6}$'),
  add constraint stores_welcome_text_valid
    check (welcome_text is null or (welcome_text = btrim(welcome_text) and char_length(welcome_text) between 1 and 160)),
  add constraint stores_logo_data_valid
    check (logo_data is null or (
      char_length(logo_data) <= 200000
      and logo_data ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$'
    ));

comment on column public.stores.brand_color is 'Cor principal da loja (#RRGGBB maiúsculo). Nulo = cor padrão #D6336C.';
comment on column public.stores.welcome_text is 'Texto de boas-vindas da página do cliente. Nulo = frase padrão.';
comment on column public.stores.logo_data is 'Logo pequeno (data URL png/jpeg/webp, até ~150 KB). Nulo = sem logo.';

grant update (brand_color, welcome_text, logo_data) on public.stores to authenticated;

-- ---------------------------------------------------------------------------
-- Visão pública do cliente pelo token do link
-- ---------------------------------------------------------------------------

-- Devolve null quando o token não existe. security definer: chamada só pela edge
-- function (service_role), lê a loja e o cliente donos do token.
create function public.get_customer_page(p_token text)
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
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select * into v_customer from public.customers c where c.link_token = p_token;
  if not found then
    return null;
  end if;

  select * into v_store from public.stores s where s.id = v_customer.store_id;

  select coalesce(sum(l.points), 0) into v_points
  from public.points_ledger l
  where l.store_id = v_customer.store_id and l.customer_id = v_customer.id;

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
  -- Os pontos creditados na mesma transação do evento (mesmo now()) acompanham o
  -- evento: a compra paga na hora ou o pagamento que quitou vendas.
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
                         and l.created_at = e.created_at)
         ) order by e.created_at desc, e.id desc), '[]'::jsonb)
  into v_history
  from events e;

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
    -- Custos das recompensas. Fixos até os tickets de resgate e raspadinha os
    -- tornarem configuráveis (padrões da spec: 10 e 5 pontos).
    'redeemCost', 10,
    'scratchCost', 5,
    'openSales', v_open,
    'history', v_history
  );
end;
$$;

revoke execute on function public.get_customer_page(text) from public, anon, authenticated;
grant execute on function public.get_customer_page(text) to service_role;
