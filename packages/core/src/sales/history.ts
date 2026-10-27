import type { PaymentMethod, RecordStatus, SalePaymentType } from './sale';

/** Uma compra no histórico do cliente. */
export interface CustomerHistorySale {
  type: 'sale';
  id: string;
  createdAt: string;
  totalCents: number;
  /** Quantas unidades, para o resumo da linha. */
  units: number;
  status: RecordStatus;
  paymentType: SalePaymentType;
}

/** Um pagamento de dívida no histórico (o pago na hora aparece dentro da compra). */
export interface CustomerHistoryPayment {
  type: 'payment';
  id: string;
  createdAt: string;
  amountCents: number;
  method: PaymentMethod;
  status: RecordStatus;
}

export type CustomerHistoryEntry = CustomerHistorySale | CustomerHistoryPayment;
