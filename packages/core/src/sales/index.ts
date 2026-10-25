import type { DbClient } from '../db/client';
import { cancelSale } from './cancelSale';
import { getSale } from './getSale';
import type { CustomerHistoryEntry } from './history';
import { listCustomerHistory } from './listCustomerHistory';
import { recordSale } from './recordSale';
import type { Sale } from './sale';
import type { RecordSaleInput, UpdateSaleInput } from './saleInput';
import { updateSale } from './updateSale';

export type {
  MemberRef,
  PaymentMethod,
  RecordStatus,
  Sale,
  SaleItem,
  SalePayment,
  SalePaymentType,
} from './sale';
export type { CustomerHistoryEntry, CustomerHistoryPayment, CustomerHistorySale } from './history';
export {
  SALE_LIMITS,
  unitPriceError,
  type RecordSaleInput,
  type SaleField,
  type SaleItemInput,
  type SalePaymentInput,
  type UpdateSaleInput,
} from './saleInput';

export interface SaleOperations {
  /** Registra uma venda paga na hora (com cliente ou avulsa, gera o pagamento) ou fiado. */
  recordSale(input: RecordSaleInput): Promise<Sale>;
  /** O detalhe da venda: itens, pagamentos, quem registrou e quando (também se cancelada). */
  getSale(id: string): Promise<Sale>;
  /** Corrige os itens da venda; o pagamento na hora e os pontos acompanham. */
  updateSale(id: string, input: UpdateSaleInput): Promise<Sale>;
  /** Cancela a venda (fica no histórico), com o pagamento na hora e os pontos dela. */
  cancelSale(id: string): Promise<Sale>;
  /** Compras e pagamentos de dívida do cliente, cancelados inclusive, mais novos primeiro. */
  listCustomerHistory(customerId: string): Promise<CustomerHistoryEntry[]>;
}

export function createSaleOperations(db: DbClient): SaleOperations {
  return {
    recordSale: (input) => recordSale(db, input),
    getSale: (id) => getSale(db, id),
    updateSale: (id, input) => updateSale(db, id, input),
    cancelSale: (id) => cancelSale(db, id),
    listCustomerHistory: (customerId) => listCustomerHistory(db, customerId),
  };
}
