import type { DbClient } from '../db/client';
import { getSale } from './getSale';
import { recordSale } from './recordSale';
import type { Sale } from './sale';
import type { RecordSaleInput } from './saleInput';

export type { MemberRef, PaymentMethod, RecordStatus, Sale, SaleItem, SalePayment } from './sale';
export {
  SALE_LIMITS,
  unitPriceError,
  type RecordSaleInput,
  type SaleField,
  type SaleItemInput,
  type SalePaymentInput,
} from './saleInput';

export interface SaleOperations {
  /** Registra uma venda paga na hora (com cliente ou avulsa) e o pagamento dela. */
  recordSale(input: RecordSaleInput): Promise<Sale>;
  /** O detalhe da venda: itens, pagamentos, quem registrou e quando. */
  getSale(id: string): Promise<Sale>;
}

export function createSaleOperations(db: DbClient): SaleOperations {
  return {
    recordSale: (input) => recordSale(db, input),
    getSale: (id) => getSale(db, id),
  };
}
