import type { DbClient } from '../db/client';
import { cancelPayment } from './cancelPayment';
import { getCustomerBalance } from './getCustomerBalance';
import { getPayment } from './getPayment';
import type { CustomerBalance, Payment, RecordedPayment } from './payment';
import type { RecordPaymentInput } from './paymentInput';
import { recordPayment } from './recordPayment';

export {
  debtAgeDays,
  type CustomerBalance,
  type Payment,
  type RecordedPayment,
  type SaleStanding,
  type SaleStandingStatus,
} from './payment';
export { PAYMENT_LIMITS, type PaymentField, type RecordPaymentInput } from './paymentInput';

export interface PaymentOperations {
  /** Registra um pagamento total ou parcial da dívida do cliente (Pix ou dinheiro). */
  recordPayment(input: RecordPaymentInput): Promise<RecordedPayment>;
  /** O saldo devedor do cliente e a situação de cada venda (alocação FIFO). */
  getCustomerBalance(customerId: string): Promise<CustomerBalance>;
  /** Um pagamento (de dívida ou o pago na hora de uma venda), ativo ou cancelado. */
  getPayment(id: string): Promise<Payment>;
  /** Cancela o pagamento (fica no histórico); a venda que ele quitava reabre. */
  cancelPayment(id: string): Promise<Payment>;
}

export function createPaymentOperations(db: DbClient): PaymentOperations {
  return {
    recordPayment: (input) => recordPayment(db, input),
    getCustomerBalance: (customerId) => getCustomerBalance(db, customerId),
    getPayment: (id) => getPayment(db, id),
    cancelPayment: (id) => cancelPayment(db, id),
  };
}
