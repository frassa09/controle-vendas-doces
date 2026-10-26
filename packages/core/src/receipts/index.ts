import type { DbClient } from '../db/client';
import {
  buildAccessMessage,
  buildPaymentReceipt,
  type PaymentReceipt,
  type ReceiptSettings,
  type WhatsAppMessage,
} from './receiptMessage';

export type { PaymentReceipt, WhatsAppMessage } from './receiptMessage';

export interface ReceiptOperations {
  /** O recibo do pagamento (valor, pontos ganhos, saldo de pontos, link) e o link do WhatsApp. */
  buildPaymentReceipt(paymentId: string): Promise<PaymentReceipt>;
  /** A mensagem de reenvio do link da página com o PIN do cliente. */
  buildAccessMessage(customerId: string): Promise<WhatsAppMessage>;
}

export function createReceiptOperations(
  db: DbClient,
  settings: ReceiptSettings,
): ReceiptOperations {
  return {
    buildPaymentReceipt: (paymentId) => buildPaymentReceipt(db, paymentId, settings),
    buildAccessMessage: (customerId) => buildAccessMessage(db, customerId, settings),
  };
}
