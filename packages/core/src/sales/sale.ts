import { CoreError } from '../errors';

/** Forma de pagamento. */
export type PaymentMethod = 'pix' | 'cash';

/** Situação de uma venda ou pagamento. Cancelados continuam no histórico. */
export type RecordStatus = 'active' | 'cancelled';

/** Como a venda foi feita: paga na hora ou fiado. */
export type SalePaymentType = 'paidNow' | 'fiado';

/** O membro que registrou algo. `email` é null se a conta dele não existe mais. */
export interface MemberRef {
  id: string;
  email: string | null;
}

/** Um item da venda, com as cópias do momento da venda. */
export interface SaleItem {
  productId: string;
  /** Nome do produto quando foi vendido. */
  productName: string;
  quantity: number;
  /** Preço unitário efetivamente cobrado, em centavos. */
  unitPriceCents: number;
  /** Pontos por unidade do produto quando foi vendido. */
  points: number;
  /** quantidade × preço unitário. */
  totalCents: number;
}

export interface SalePayment {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  status: RecordStatus;
  recordedBy: MemberRef;
  createdAt: string;
  /** Quando foi cancelado (null se ativo), e por quem. */
  cancelledAt: string | null;
  cancelledBy: MemberRef | null;
}

/** Uma venda, como o detalhe da venda a mostra. */
export interface Sale {
  id: string;
  /** null em venda avulsa. */
  customer: { id: string; name: string } | null;
  items: SaleItem[];
  totalCents: number;
  status: RecordStatus;
  recordedBy: MemberRef;
  createdAt: string;
  /** Última edição dos itens (null se nunca foi editada). */
  editedAt: string | null;
  editedBy: MemberRef | null;
  /** Quando foi cancelada (null se ativa), e por quem. */
  cancelledAt: string | null;
  cancelledBy: MemberRef | null;
  /** Paga na hora ou fiado (fiado não tem pagamento ligado à venda). */
  paymentType: SalePaymentType;
  /** Pagamentos ligados à venda (a venda paga na hora tem um, de mesmo valor). */
  payments: SalePayment[];
}

export function saleNotFound(): CoreError {
  return new CoreError('SALE_NOT_FOUND');
}
