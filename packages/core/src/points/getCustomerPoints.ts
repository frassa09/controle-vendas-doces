import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import type { CustomerPoints, PointsMovementKind } from './points';

const kinds: Partial<Record<string, PointsMovementKind>> = {
  sale_credit: 'saleCredit',
  sale_reversal: 'saleReversal',
  sale_adjustment: 'saleAdjustment',
  redemption: 'redemption',
  scratch: 'scratch',
  expiration: 'expiration',
};

/** Saldo e extrato de pontos do cliente. Erros: NOT_AUTHENTICATED, CUSTOMER_NOT_FOUND. */
export async function getCustomerPoints(db: DbClient, customerId: string): Promise<CustomerPoints> {
  await requireUserId(db);
  if (!isUuid(customerId)) throw new CoreError('CUSTOMER_NOT_FOUND');

  // Vence o saldo se o prazo passou e já traz a data de vencimento do que sobrou.
  const expiry = await db.rpc('expire_customer_points', { p_customer_id: customerId });
  if (expiry.error) throw fromDbError(expiry.error);
  // Retorno anulável sai `string` nos tipos gerados.
  const expiresAt = expiry.data as string | null;

  const [customer, ledger] = await Promise.all([
    db.from('customers').select('id').eq('id', customerId).maybeSingle(),
    db
      .from('points_ledger')
      .select('id, kind, points, sale_id, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
  ]);
  if (customer.error) throw fromDbError(customer.error);
  if (!customer.data) throw new CoreError('CUSTOMER_NOT_FOUND');
  if (ledger.error) throw fromDbError(ledger.error);

  const movements = ledger.data.map((row) => ({
    id: row.id,
    kind: kinds[row.kind] ?? 'saleCredit',
    points: row.points,
    saleId: row.sale_id,
    createdAt: row.created_at,
  }));
  return {
    customerId,
    expiresAt,
    balance: movements.reduce((sum, movement) => sum + movement.points, 0),
    movements,
  };
}
