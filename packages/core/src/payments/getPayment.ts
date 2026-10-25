import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { memberEmails, toMemberRef } from '../sales/members';
import type { PaymentMethod, RecordStatus } from '../sales/sale';
import type { Payment } from './payment';

export function paymentNotFound(): CoreError {
  return new CoreError('PAYMENT_NOT_FOUND');
}

/** Um pagamento da loja, ativo ou cancelado. Erros: NOT_AUTHENTICATED, PAYMENT_NOT_FOUND. */
export async function getPayment(db: DbClient, id: string): Promise<Payment> {
  await requireUserId(db);
  if (!isUuid(id)) throw paymentNotFound();

  // O RLS só mostra pagamentos da própria loja.
  const [result, members] = await Promise.all([
    db
      .from('payments')
      .select(
        'id, customer_id, sale_id, amount_cents, method, status, recorded_by, created_at, cancelled_at, cancelled_by',
      )
      .eq('id', id)
      .maybeSingle(),
    memberEmails(db),
  ]);
  const { data, error } = result;
  if (error) throw fromDbError(error);
  if (!data) throw paymentNotFound();

  return {
    id: data.id,
    customerId: data.customer_id,
    saleId: data.sale_id,
    amountCents: data.amount_cents,
    method: data.method as PaymentMethod,
    status: data.status as RecordStatus,
    recordedBy: toMemberRef(members, data.recorded_by),
    createdAt: data.created_at,
    cancelledAt: data.cancelled_at,
    cancelledBy: data.cancelled_by === null ? null : toMemberRef(members, data.cancelled_by),
  };
}
