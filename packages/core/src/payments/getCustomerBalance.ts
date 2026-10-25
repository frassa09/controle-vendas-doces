import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import type { CustomerBalance, SaleStanding } from './payment';

/** O saldo devedor do cliente, venda a venda. Erros: NOT_AUTHENTICATED, CUSTOMER_NOT_FOUND. */
export async function getCustomerBalance(
  db: DbClient,
  customerId: string,
): Promise<CustomerBalance> {
  await requireUserId(db);
  if (!isUuid(customerId)) throw new CoreError('CUSTOMER_NOT_FOUND');

  const { data, error } = await db.rpc('get_customer_balance', { p_customer_id: customerId });
  if (error) throw fromDbError(error);

  const sales = data.map((row): SaleStanding => {
    const remainingCents = row.total_cents - row.paid_cents;
    return {
      saleId: row.sale_id,
      createdAt: row.created_at,
      totalCents: row.total_cents,
      paidCents: row.paid_cents,
      remainingCents,
      status: remainingCents === 0 ? 'paid' : row.paid_cents > 0 ? 'partial' : 'open',
    };
  });

  return {
    customerId,
    balanceCents: sales.reduce((sum, sale) => sum + sale.remainingCents, 0),
    debtSince: sales.find((sale) => sale.remainingCents > 0)?.createdAt ?? null,
    sales,
  };
}
