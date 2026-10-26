import type { DbClient } from '../db/client';
import { getSale } from './getSale';
import { listSales, type ListSalesOptions, type SaleListItem } from './listSales';
import { recordSale } from './recordSale';
import type { Sale } from './sale';
import type { RecordSaleInput } from './saleInput';

export type {
  MemberRef,
  PaymentMethod,
  RecordStatus,
  Sale,
  SaleItem,
  SalePayment,
  SalePaymentType,
} from './sale';
export type { ListSalesOptions, SaleListItem, SaleListStanding } from './listSales';
export {
  SALE_LIMITS,
  unitPriceError,
  type RecordSaleInput,
  type SaleField,
  type SaleItemInput,
  type SalePaymentInput,
} from './saleInput';

export interface SaleOperations {
  /** Registra uma venda paga na hora (com cliente ou avulsa, gera o pagamento) ou fiado. */
  recordSale(input: RecordSaleInput): Promise<Sale>;
  /** O detalhe da venda: itens, pagamentos, quem registrou e quando. */
  getSale(id: string): Promise<Sale>;
  /** As vendas ativas, da mais nova para a mais antiga, com situação de pagamento. */
  listSales(options?: ListSalesOptions): Promise<SaleListItem[]>;
}

export function createSaleOperations(db: DbClient): SaleOperations {
  return {
    recordSale: (input) => recordSale(db, input),
    getSale: (id) => getSale(db, id),
    listSales: (options) => listSales(db, options),
  };
}
