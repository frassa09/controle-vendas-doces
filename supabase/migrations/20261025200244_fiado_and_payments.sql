-- Fiado, pagamentos posteriores e saldo devedor.
--
-- O saldo devedor nunca é guardado: sai de vendas ativas e pagamentos ativos.
-- Cada venda ativa do cliente é paga primeiro pelos pagamentos ligados a ela
-- (sale_id, o "pago agora"); os pagamentos sem venda (pagamentos de dívida) quitam
-- as vendas em aberto mais antigas primeiro (FIFO). Isso diz quais vendas estão
-- quitadas, parcialmente pagas ou em aberto, e desde quando o cliente deve.
-- Gravação continua só por funções: record_sale passa a aceitar fiado (forma de
-- pagamento nula) e record_payment registra o pagamento de dívida.

-- ---------------------------------------------------------------------------
-- Situação de cada venda ativa do cliente (alocação FIFO)
-- ---------------------------------------------------------------------------

-- Uma linha por venda ativa do cliente, da mais antiga para a mais nova, com o
-- total e quanto dele já foi pago. Saldo devedor = soma de (total - pago).
-- security invoker: chamada pelo membro, o RLS limita à própria loja; chamada de
-- dentro de record_payment (security definer), lê a loja indicada.
create function private.customer_sale_standing(p_store_id uuid, p_customer_id uuid)
returns table (sale_id uuid, created_at timestamptz, total_cents bigint, paid_cents bigint)
language sql
stable
set search_path = ''
as $$
  with sale_totals as (
    select s.id, s.created_at,
           (select coalesce(sum(i.unit_price_cents::bigint * i.quantity), 0)
              from public.sale_items i where i.sale_id = s.id) as total,
           (select coalesce(sum(p.amount_cents), 0)::bigint
              from public.payments p where p.sale_id = s.id and p.status = 'active') as direct
    from public.sales s
    where s.store_id = p_store_id and s.customer_id = p_customer_id and s.status = 'active'
  ),
  dues as (
    select t.id, t.created_at, t.total,
           greatest(t.total - t.direct, 0) as due,
           -- Quanto as vendas até esta (inclusive) ainda devem depois do "pago agora".
           sum(greatest(t.total - t.direct, 0)) over (order by t.created_at, t.id) as due_through
    from sale_totals t
  ),
  pool as (
    select coalesce(sum(p.amount_cents), 0)::bigint as amount
    from public.payments p
    where p.store_id = p_store_id and p.customer_id = p_customer_id
      and p.sale_id is null and p.status = 'active'
  )
  select d.id, d.created_at, d.total,
         d.total - d.due + least(d.due, greatest(pool.amount - (d.due_through - d.due), 0))
  from dues d
  cross join pool
  order by d.created_at, d.id
$$;

revoke execute on function private.customer_sale_standing(uuid, uuid) from public, anon;
grant execute on function private.customer_sale_standing(uuid, uuid) to authenticated;

-- O saldo do cliente, venda a venda. Erros: CUSTOMER_NOT_FOUND (inexistente ou de
-- outra loja, que o RLS esconde).
create function public.get_customer_balance(p_customer_id uuid)
returns table (sale_id uuid, created_at timestamptz, total_cents bigint, paid_cents bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_store uuid;
begin
  select c.store_id into v_store from public.customers c where c.id = p_customer_id;
  if v_store is null then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_NOT_FOUND';
  end if;
  return query select * from private.customer_sale_standing(v_store, p_customer_id);
end;
$$;

revoke execute on function public.get_customer_balance(uuid) from public, anon;
grant execute on function public.get_customer_balance(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Operação: registrar venda (agora também fiado)
-- ---------------------------------------------------------------------------

-- p_payment_method: 'pix' | 'cash' = pago agora; null = fiado (sem pagamento),
-- que exige cliente. O resto é igual ao do ticket de venda rápida.
create or replace function public.record_sale(
  p_customer_id uuid, p_items jsonb, p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_store uuid;
  v_sale uuid;
  v_total bigint;
  v_missing boolean;
  v_inactive boolean;
begin
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  select m.store_id into v_store from public.store_members m where m.user_id = v_user;
  if v_store is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  -- Venda avulsa não pode ser fiado: não haveria de quem cobrar.
  if p_payment_method is null and p_customer_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers c where c.store_id = v_store and c.id = p_customer_id
  ) then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_NOT_FOUND';
  end if;

  select bool_or(p.id is null), bool_or(not p.is_active)
  into v_missing, v_inactive
  from jsonb_to_recordset(p_items) as i (product_id uuid)
  left join public.products p on p.store_id = v_store and p.id = i.product_id;

  if v_missing then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  end if;
  if v_inactive then
    raise exception using errcode = 'P0001', message = 'PRODUCT_INACTIVE';
  end if;

  insert into public.sales (store_id, customer_id, recorded_by)
  values (v_store, p_customer_id, v_user)
  returning id into v_sale;

  -- Quantidade ou preço fora dos limites caem nas constraints (INVALID_INPUT).
  insert into public.sale_items
    (store_id, sale_id, position, product_id, product_name, unit_price_cents, points, quantity)
  select v_store, v_sale, e.position, p.id, p.name,
         coalesce((e.item ->> 'unit_price_cents')::integer, p.price_cents), p.points,
         (e.item ->> 'quantity')::integer
  from jsonb_array_elements(p_items) with ordinality as e (item, position)
  join public.products p
    on p.store_id = v_store and p.id = (e.item ->> 'product_id')::uuid;

  select sum(si.unit_price_cents::bigint * si.quantity) into v_total
  from public.sale_items si
  where si.sale_id = v_sale;

  -- No máximo R$ 100.000,00 por venda (o mesmo limite do core).
  if v_total > 10000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  if p_payment_method is not null then
    insert into public.payments (store_id, customer_id, sale_id, amount_cents, method, recorded_by)
    values (v_store, p_customer_id, v_sale, v_total::integer, p_payment_method, v_user);
  end if;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operação: registrar pagamento de dívida
-- ---------------------------------------------------------------------------

-- Pagamento total ou parcial do saldo devedor do cliente. Valor acima do saldo é
-- recusado (PAYMENT_EXCEEDS_BALANCE). A linha do cliente fica travada até o fim
-- da transação, para dois pagamentos ao mesmo tempo não passarem do saldo.
create function public.record_payment(
  p_customer_id uuid, p_amount_cents integer, p_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_store uuid;
  v_balance bigint;
  v_payment uuid;
begin
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  select m.store_id into v_store from public.store_members m where m.user_id = v_user;
  if v_store is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  perform 1 from public.customers c
  where c.store_id = v_store and c.id = p_customer_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_NOT_FOUND';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  select coalesce(sum(s.total_cents - s.paid_cents), 0) into v_balance
  from private.customer_sale_standing(v_store, p_customer_id) s;

  if p_amount_cents > v_balance then
    raise exception using errcode = 'P0001', message = 'PAYMENT_EXCEEDS_BALANCE';
  end if;

  insert into public.payments (store_id, customer_id, amount_cents, method, recorded_by)
  values (v_store, p_customer_id, p_amount_cents, p_method, v_user)
  returning id into v_payment;

  return v_payment;
end;
$$;

revoke execute on function public.record_payment(uuid, integer, text) from public, anon;
grant execute on function public.record_payment(uuid, integer, text) to authenticated;
