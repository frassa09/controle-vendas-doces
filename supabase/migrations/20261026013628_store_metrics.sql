-- Métricas de vendas, produtos e clientes de um período.
--
-- Uma função só (security invoker: o RLS limita tudo à loja de quem chama) agrega
-- no banco e devolve um jsonb; o core chama uma vez para o período e outra para o
-- período anterior. Só entram vendas e pagamentos ativos (cancelados ficam de fora).
--
--  - faturamento = soma dos itens das vendas ativas do período;
--  - recebido = pagamentos ativos feitos no período (inclui pagamento de dívida);
--  - a receber = o que ainda falta pagar das vendas do período (alocação FIFO do
--    private.customer_sale_standing, a mesma do saldo devedor);
--  - desconto = diferença entre o preço atual do produto e o cobrado, por unidade,
--    quando o cobrado é menor;
--  - cliente novo = primeira compra ativa dentro do período; sumido = última compra
--    até p_lapsed_days antes do fim do período (ou de agora, se o período não acabou).

create function public.store_metrics(
  p_from timestamptz,
  p_to timestamptz,
  p_time_zone text,
  p_lapsed_days integer
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_ref timestamptz := least(p_to, now());
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if p_from >= p_to or p_lapsed_days < 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  begin
    perform now() at time zone p_time_zone;
  exception when others then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end;

  with
  period_sales as (
    select s.id, s.customer_id, s.created_at,
           (select coalesce(sum(i.unit_price_cents::bigint * i.quantity), 0)
              from public.sale_items i where i.sale_id = s.id) as total
    from public.sales s
    where s.status = 'active' and s.created_at >= p_from and s.created_at < p_to
  ),
  period_payments as (
    select p.method, p.amount_cents
    from public.payments p
    where p.status = 'active' and p.created_at >= p_from and p.created_at < p_to
  ),
  period_items as (
    select i.sale_id, i.product_id, p.name, p.is_combo, i.quantity,
           i.unit_price_cents::bigint * i.quantity as revenue,
           greatest(p.price_cents - i.unit_price_cents, 0)::bigint * i.quantity as discount
    from period_sales ps
    join public.sale_items i on i.sale_id = ps.id
    join public.products p on p.id = i.product_id
  ),
  product_rows as (
    select product_id, name, bool_or(is_combo) as is_combo,
           sum(quantity)::bigint as quantity, sum(revenue)::bigint as revenue,
           sum(discount)::bigint as discount
    from period_items
    group by product_id, name
  ),
  buyers as (
    select distinct c.store_id, c.id
    from public.customers c
    where c.id in (select customer_id from period_sales where customer_id is not null)
  ),
  open_amount as (
    select coalesce(sum(greatest(s.total_cents - s.paid_cents, 0)), 0)::bigint as cents
    from buyers b
    cross join lateral private.customer_sale_standing(b.store_id, b.id) s
    where s.sale_id in (select id from period_sales)
  ),
  customer_period as (
    select ps.customer_id, count(*)::bigint as sales, sum(ps.total)::bigint as total
    from period_sales ps
    where ps.customer_id is not null
    group by ps.customer_id
  ),
  customer_life as (
    select s.customer_id, min(s.created_at) as first_at,
           max(s.created_at) filter (where s.created_at < p_to) as last_at,
           count(*) filter (where s.created_at < p_to) as sales_before_end,
           sum((select coalesce(sum(i.unit_price_cents::bigint * i.quantity), 0)
                  from public.sale_items i where i.sale_id = s.id))
             filter (where s.created_at < p_to)::bigint as total_before_end
    from public.sales s
    where s.status = 'active' and s.customer_id is not null
    group by s.customer_id
  ),
  lapsed as (
    select l.customer_id, c.name, l.last_at, l.sales_before_end, l.total_before_end
    from customer_life l
    join public.customers c on c.id = l.customer_id
    where l.last_at is not null and l.last_at < v_ref - make_interval(days => p_lapsed_days)
  )
  select jsonb_build_object(
    'salesCount', (select count(*) from period_sales),
    'revenueCents', (select coalesce(sum(total), 0) from period_sales),
    'receivedCents', (select coalesce(sum(amount_cents), 0) from period_payments),
    'toReceiveCents', (select cents from open_amount),
    'byMethod', (
      select jsonb_build_object(
        'pix', jsonb_build_object(
          'count', count(*) filter (where method = 'pix'),
          'cents', coalesce(sum(amount_cents) filter (where method = 'pix'), 0)),
        'cash', jsonb_build_object(
          'count', count(*) filter (where method = 'cash'),
          'cents', coalesce(sum(amount_cents) filter (where method = 'cash'), 0)))
      from period_payments),
    'byWeekday', (
      select jsonb_agg(jsonb_build_object(
        'weekday', d.n,
        'salesCount', coalesce(x.cnt, 0),
        'revenueCents', coalesce(x.rev, 0)) order by d.n)
      from generate_series(0, 6) as d(n)
      left join (
        select extract(dow from ps.created_at at time zone p_time_zone)::int as n,
               count(*) as cnt, sum(ps.total) as rev
        from period_sales ps group by 1) x on x.n = d.n),
    'byHour', (
      select jsonb_agg(jsonb_build_object(
        'hour', h.n,
        'salesCount', coalesce(x.cnt, 0),
        'revenueCents', coalesce(x.rev, 0)) order by h.n)
      from generate_series(0, 23) as h(n)
      left join (
        select extract(hour from ps.created_at at time zone p_time_zone)::int as n,
               count(*) as cnt, sum(ps.total) as rev
        from period_sales ps group by 1) x on x.n = h.n),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productId', r.product_id, 'name', r.name, 'isCombo', r.is_combo,
        'quantity', r.quantity, 'revenueCents', r.revenue, 'discountCents', r.discount)
        order by r.quantity desc, r.revenue desc, r.name)
      from product_rows r), '[]'::jsonb),
    'discounts', jsonb_build_object(
      'totalCents', (select coalesce(sum(discount), 0) from period_items),
      'units', (select coalesce(sum(quantity) filter (where discount > 0), 0) from period_items),
      'salesCount', (select count(distinct sale_id) filter (where discount > 0) from period_items)),
    'customers', jsonb_build_object(
      'buyersCount', (select count(*) from customer_period),
      'customerSalesCount', (select coalesce(sum(sales), 0) from customer_period),
      'walkInSalesCount', (select count(*) from period_sales where customer_id is null),
      'newCount', (select count(*) from customer_period cp
                    join customer_life l on l.customer_id = cp.customer_id
                    where l.first_at >= p_from),
      'returningCount', (select count(*) from customer_period cp
                          join customer_life l on l.customer_id = cp.customer_id
                          where l.first_at < p_from),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object(
          'customerId', t.customer_id, 'name', t.name,
          'salesCount', t.sales, 'totalCents', t.total) order by t.total desc, t.name)
        from (select cp.customer_id, c.name, cp.sales, cp.total
              from customer_period cp join public.customers c on c.id = cp.customer_id
              order by cp.total desc, c.name limit 10) t), '[]'::jsonb),
      'lapsedCount', (select count(*) from lapsed),
      'lapsed', coalesce((
        select jsonb_agg(jsonb_build_object(
          'customerId', t.customer_id, 'name', t.name, 'lastPurchaseAt', t.last_at,
          'salesCount', t.sales_before_end, 'totalCents', t.total_before_end)
          order by t.total_before_end desc, t.name)
        from (select * from lapsed order by total_before_end desc, name limit 10) t),
        '[]'::jsonb))
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.store_metrics(timestamptz, timestamptz, text, integer)
  from public, anon;
grant execute on function public.store_metrics(timestamptz, timestamptz, text, integer)
  to authenticated;
