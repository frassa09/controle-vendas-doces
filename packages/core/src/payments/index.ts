import type { DbClient } from '../db/client';
import { getCustomerBalance } from './getCustomerBalance';
import type { CustomerBalance, RecordedPayment } from './payment';
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
}

export function createPaymentOperations(db: DbClient): PaymentOperations {
  return {
    recordPayment: (input) => recordPayment(db, input),
    getCustomerBalance: (customerId) => getCustomerBalance(db, customerId),
  };
}
