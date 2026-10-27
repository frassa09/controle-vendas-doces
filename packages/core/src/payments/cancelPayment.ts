import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { getPayment, paymentNotFound } from './getPayment';
import type { Payment } from './payment';

/**
 * Cancela um pagamento marcado por engano. Ele continua no histórico como
 * cancelado e o valor volta para o saldo devedor; a venda que ele quitava volta a
 * ficar em aberto e os pontos dela são estornados.
 * Erros: NOT_AUTHENTICATED, PAYMENT_NOT_FOUND, PAYMENT_CANCELLED,
 * WALK_IN_SALE_PAYMENT (pagamento de venda avulsa: cancele a venda).
 */
export async function cancelPayment(db: DbClient, id: string): Promise<Payment> {
  await requireUserId(db);
  if (!isUuid(id)) throw paymentNotFound();

  const { error } = await db.rpc('cancel_payment', { p_payment_id: id });
  if (error) throw fromDbError(error);
  return getPayment(db, id);
}
