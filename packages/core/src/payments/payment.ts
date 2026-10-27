import type { MemberRef, PaymentMethod, RecordStatus } from '../sales/sale';

/** Quanto de uma venda já foi pago: quitada, paga em parte ou em aberto. */
export type SaleStandingStatus = 'paid' | 'partial' | 'open';

/** Uma venda ativa do cliente e quanto dela os pagamentos já cobriram (FIFO). */
export interface SaleStanding {
  saleId: string;
  createdAt: string;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  status: SaleStandingStatus;
}

/**
 * O saldo devedor do cliente, sempre calculado (nunca guardado): vendas ativas
 * menos pagamentos ativos. Os pagamentos de dívida quitam primeiro as vendas mais
 * antigas, o que define a situação de cada venda e desde quando o cliente deve.
 */
export interface CustomerBalance {
  customerId: string;
  /** Quanto o cliente deve, em centavos (0 = nada). */
  balanceCents: number;
  /** Quando foi feita a venda mais antiga ainda não quitada; null sem dívida. */
  debtSince: string | null;
  /** Todas as vendas ativas do cliente, da mais antiga para a mais nova. */
  sales: SaleStanding[];
}

/** Um pagamento recebido (de dívida, ou o pago na hora de uma venda). */
export interface Payment {
  id: string;
  /** null só no pagamento de venda avulsa. */
  customerId: string | null;
  /** A venda paga na hora que gerou o pagamento; null no pagamento de dívida. */
  saleId: string | null;
  amountCents: number;
  method: PaymentMethod;
  status: RecordStatus;
  recordedBy: MemberRef;
  createdAt: string;
  /** Quando foi cancelado (null se ativo), e por quem. */
  cancelledAt: string | null;
  cancelledBy: MemberRef | null;
}

/** O pagamento registrado e como ficou o saldo do cliente depois dele. */
export interface RecordedPayment {
  payment: Payment;
  balance: CustomerBalance;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Há quantos dias completos a dívida está aberta (idade da dívida); null sem dívida. */
export function debtAgeDays(balance: CustomerBalance, now: Date = new Date()): number | null {
  if (balance.debtSince === null) return null;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(balance.debtSince)) / DAY_MS));
}
