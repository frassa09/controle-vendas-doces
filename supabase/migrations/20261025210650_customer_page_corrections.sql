-- Página do cliente depois das correções de venda e pagamento.
--
-- O saldo de pontos (soma do livro, inclusive estornos e ajustes) e as vendas em
-- aberto (customer_sale_standing, só ativas) já refletem cancelamentos e edições.
-- O que muda aqui: nos recadinhos, os pontos de um evento só contam enquanto a
-- venda que os gerou ainda mantém pontos no livro. Uma compra paga na hora cujo
-- pagamento foi cancelado, ou uma venda cancelada, não mostra mais "+N" que já foi
-- estornado. O resto da função é igual ao do ticket da página do cliente.

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
  -- evento: a compra paga na hora ou o pagamento que quitou vendas. Pontos de uma
  -- venda que depois foram estornados (saldo da venda no livro zerado) não contam.
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
                         and (l.sale_id is null
                              or (select sum(k.points) from public.points_ledger k
                                   where k.sale_id = l.sale_id) > 0))
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
