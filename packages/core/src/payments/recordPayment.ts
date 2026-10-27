import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { formatCents } from '../money';
import { getCustomerBalance } from './getCustomerBalance';
import { getPayment } from './getPayment';
import type { RecordedPayment } from './payment';
import { validatePayment, type PaymentField, type RecordPaymentInput } from './paymentInput';

/**
 * Registra um pagamento (total ou parcial) do saldo devedor do cliente, em nome de
 * quem está logado. Ele quita primeiro as vendas em aberto mais antigas.
 * Erros: INVALID_INPUT, NOT_AUTHENTICATED, FORBIDDEN (sem loja), CUSTOMER_NOT_FOUND,
 * PAYMENT_EXCEEDS_BALANCE (valor maior que o saldo devedor).
 */
export async function recordPayment(
  db: DbClient,
  input: RecordPaymentInput,
): Promise<RecordedPayment> {
  validatePayment(input);
  await requireUserId(db);
  if (!isUuid(input.customerId)) throw new CoreError('CUSTOMER_NOT_FOUND');

  const { data: paymentId, error } = await db.rpc('record_payment', {
    p_customer_id: input.customerId,
    p_amount_cents: input.amountCents,
    p_method: input.method,
  });
  if (error) {
    const failure = fromDbError(error);
    if (failure.code === 'PAYMENT_EXCEEDS_BALANCE') throw await exceedsBalance(db, input);
    throw failure;
  }

  const [payment, balance] = await Promise.all([
    getPayment(db, paymentId),
    getCustomerBalance(db, input.customerId),
  ]);

  return {
    payment,
    balance,
  };
}

/** A recusa com o saldo atual na mensagem, para a pessoa corrigir o valor. */
async function exceedsBalance(db: DbClient, input: RecordPaymentInput): Promise<CoreError> {
  const { balanceCents } = await getCustomerBalance(db, input.customerId);
  const message =
    balanceCents === 0
      ? 'Este cliente não tem saldo devedor.'
      : `O saldo devedor é ${formatCents(balanceCents)}. Registre no máximo esse valor.`;
  return new CoreError<PaymentField>('PAYMENT_EXCEEDS_BALANCE', {
    message,
    fieldErrors: { amountCents: message },
  });
}
