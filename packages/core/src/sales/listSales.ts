import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { getCustomerBalance } from '../payments/getCustomerBalance';
import type { PaymentMethod } from './sale';

/** Situação de uma venda na lista: paga na hora (com a forma) ou fiado (com o andamento). */
export type SaleListStanding =
  | { type: 'paidNow'; method: PaymentMethod }
  | { type: 'fiado'; status: 'open' | 'partial' | 'paid' };

export interface SaleListItem {
  id: string;
  createdAt: string;
  /** Nome do cliente; null em venda avulsa. */
  customerName: string | null;
  /** Ex.: "2× Brownie, 1× Cocada". */
  summary: string;
  totalCents: number;
  standing: SaleListStanding;
}

export interface ListSalesOptions {
  /** Início (inclusive), ISO. */
  from?: string;
  /** Fim (exclusivo), ISO. */
  to?: string;
  /** Padrão 200. */
  limit?: number;
}

const DEFAULT_LIMIT = 200;

/** As vendas ativas da loja, da mais nova para a mais antiga. */
export async function listSales(
  db: DbClient,
  options: ListSalesOptions = {},
): Promise<SaleListItem[]> {
  await requireUserId(db);

  let query = db
    .from('sales')
    .select(
      `id, created_at,
       customer:customers!sales_customer_fkey (id, name),
       sale_items (position, product_name, quantity, unit_price_cents),
       payments (method, status)`,
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .order('position', { referencedTable: 'sale_items' })
    .limit(options.limit ?? DEFAULT_LIMIT);
  if (options.from) query = query.gte('created_at', options.from);
  if (options.to) query = query.lt('created_at', options.to);

  const { data, error } = await query;
  if (error) throw fromDbError(error);

  // Andamento do fiado: uma leitura por cliente, reaproveitando o saldo (FIFO) do #7.
  const debtors = [
    ...new Set(
      data
        .filter((s) => !s.payments.some((p) => p.status === 'active') && s.customer)
        .map((s) => s.customer?.id ?? ''),
    ),
  ];
  const balances = new Map(
    await Promise.all(debtors.map(async (id) => [id, await getCustomerBalance(db, id)] as const)),
  );

  return data.map((sale): SaleListItem => {
    const totalCents = sale.sale_items.reduce((sum, i) => sum + i.unit_price_cents * i.quantity, 0);
    // Pagamento na hora cancelado (#9) deixa a venda em aberto na conta do cliente.
    const payment = sale.payments.find((p) => p.status === 'active');
    const standing: SaleListStanding = payment
      ? { type: 'paidNow', method: payment.method as PaymentMethod }
      : {
          type: 'fiado',
          status:
            balances.get(sale.customer?.id ?? '')?.sales.find((s) => s.saleId === sale.id)
              ?.status ?? 'open',
        };
    return {
      id: sale.id,
      createdAt: sale.created_at,
      customerName: sale.customer?.name ?? null,
      summary: sale.sale_items.map((i) => `${String(i.quantity)}× ${i.product_name}`).join(', '),
      totalCents,
      standing,
    };
  });
}
