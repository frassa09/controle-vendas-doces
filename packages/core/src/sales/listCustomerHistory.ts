import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import type { CustomerHistoryEntry } from './history';
import type { PaymentMethod, RecordStatus } from './sale';

/**
 * Compras e pagamentos de dívida do cliente, inclusive os cancelados, do mais novo
 * para o mais antigo. Erros: NOT_AUTHENTICATED, CUSTOMER_NOT_FOUND.
 */
export async function listCustomerHistory(
  db: DbClient,
  customerId: string,
): Promise<CustomerHistoryEntry[]> {
  await requireUserId(db);
  if (!isUuid(customerId)) throw new CoreError('CUSTOMER_NOT_FOUND');

  // O RLS só mostra dados da própria loja.
  const [customer, sales, payments] = await Promise.all([
    db.from('customers').select('id').eq('id', customerId).maybeSingle(),
    db
      .from('sales')
      .select('id, status, created_at, sale_items (quantity, unit_price_cents), payments (id)')
      .eq('customer_id', customerId),
    db
      .from('payments')
      .select('id, amount_cents, method, status, created_at')
      .eq('customer_id', customerId)
      .is('sale_id', null),
  ]);
  if (customer.error) throw fromDbError(customer.error);
  if (!customer.data) throw new CoreError('CUSTOMER_NOT_FOUND');
  if (sales.error) throw fromDbError(sales.error);
  if (payments.error) throw fromDbError(payments.error);

  const entries: CustomerHistoryEntry[] = [
    ...sales.data.map((sale) => ({
      type: 'sale' as const,
      id: sale.id,
      createdAt: sale.created_at,
      totalCents: sale.sale_items.reduce(
        (sum, item) => sum + item.unit_price_cents * item.quantity,
        0,
      ),
      units: sale.sale_items.reduce((sum, item) => sum + item.quantity, 0),
      status: sale.status as RecordStatus,
      // Só a venda paga na hora tem pagamento ligado a ela.
      paymentType: sale.payments.length > 0 ? ('paidNow' as const) : ('fiado' as const),
    })),
    ...payments.data.map((payment) => ({
      type: 'payment' as const,
      id: payment.id,
      createdAt: payment.created_at,
      amountCents: payment.amount_cents,
      method: payment.method as PaymentMethod,
      status: payment.status as RecordStatus,
    })),
  ];
  return entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
