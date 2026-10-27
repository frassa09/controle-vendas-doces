import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { memberEmails, toMemberRef } from '../sales/members';
import { couponColumns, toCoupon, type Coupon } from './coupon';

/**
 * Dá baixa no cupom: o prêmio foi entregue agora, por quem está logado.
 * Erros: NOT_AUTHENTICATED, FORBIDDEN, COUPON_NOT_FOUND, COUPON_ALREADY_DELIVERED.
 */
export async function deliverCoupon(db: DbClient, couponId: string): Promise<Coupon> {
  await requireUserId(db);
  if (!isUuid(couponId)) throw new CoreError('COUPON_NOT_FOUND');

  const delivered = await db.rpc('deliver_coupon', { p_coupon_id: couponId });
  if (delivered.error) throw fromDbError(delivered.error);

  const [read, emails] = await Promise.all([
    db.from('coupons').select(couponColumns).eq('id', couponId).single(),
    memberEmails(db),
  ]);
  if (read.error) throw fromDbError(read.error);
  const row = read.data;
  return toCoupon(
    row,
    row.customer.name,
    row.delivered_by ? toMemberRef(emails, row.delivered_by) : null,
  );
}
