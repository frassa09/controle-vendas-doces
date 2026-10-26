import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { couponColumns, toCoupon, type Coupon } from './coupon';

export interface ListPendingCouponsOptions {
  /** Só os cupons deste cliente; sem ele, todos os pendentes da loja. */
  customerId?: string;
}

/**
 * Cupons ainda não entregues, do mais antigo para o mais novo.
 * Erros: NOT_AUTHENTICATED, CUSTOMER_NOT_FOUND (id inválido).
 */
export async function listPendingCoupons(
  db: DbClient,
  options: ListPendingCouponsOptions = {},
): Promise<Coupon[]> {
  await requireUserId(db);
  const { customerId } = options;
  if (customerId !== undefined && !isUuid(customerId)) throw new CoreError('CUSTOMER_NOT_FOUND');

  let query = db.from('coupons').select(couponColumns).eq('status', 'pending');
  if (customerId !== undefined) query = query.eq('customer_id', customerId);
  const { data, error } = await query
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw fromDbError(error);
  return data.map((row) => toCoupon(row, row.customer.name, null));
}
