import type { CouponOrigin } from '../coupons/coupon';
import type { PaymentMethod, RecordStatus, SalePaymentType } from '../sales';

/** Um produto que o cliente pode escolher como prêmio (ativo e marcado pela loja). */
export interface CustomerViewPrize {
  id: string;
  name: string;
}

/** Um prêmio ainda não retirado, como a página do cliente mostra. */
export interface CustomerViewCoupon {
  id: string;
  productName: string;
  origin: CouponOrigin;
  createdAt: string;
}

/** Pedido de troca de pontos por um prêmio (resgate direto). */
export interface RedeemRewardInput {
  /** Token do link da página. */
  token: string;
  /** PIN de 4 dígitos do cliente. */
  pin: string;
  /** Um dos `prizes` da visão. */
  productId: string;
}

/** Resultado do resgate: o cupom criado e o saldo de pontos depois do débito. */
export interface RedeemRewardResult {
  coupon: CustomerViewCoupon;
  balance: number;
}

/** Um item como a página do cliente o mostra (nome copiado na hora da venda). */
export interface CustomerViewItem {
  name: string;
  quantity: number;
}

/** Uma compra ainda não quitada (alocação FIFO), com o que falta pagar dela. */
export interface CustomerViewOpenSale {
  saleId: string;
  createdAt: string;
  totalCents: number;
  remainingCents: number;
  items: CustomerViewItem[];
}

/** Um recadinho: uma compra ou um pagamento de dívida. */
export type CustomerViewEntry =
  | {
      kind: 'sale';
      id: string;
      createdAt: string;
      status: RecordStatus;
      totalCents: number;
      paymentType: SalePaymentType;
      /** Forma do pagamento na hora; null no fiado. */
      method: PaymentMethod | null;
      items: CustomerViewItem[];
      /** Pontos creditados junto com a compra (paga na hora). */
      points: number;
    }
  | {
      kind: 'payment';
      id: string;
      createdAt: string;
      status: RecordStatus;
      amountCents: number;
      method: PaymentMethod;
      /** Pontos das compras que este pagamento quitou. */
      points: number;
    };

/**
 * O que a página pública do cliente mostra. Só dados do cliente dono do token:
 * nunca PIN, telefone, observações nem dados de outros clientes.
 */
export interface CustomerView {
  store: {
    name: string;
    /** Cor principal (#RRGGBB) ou null para a cor padrão. */
    brandColor: string | null;
    welcomeText: string | null;
    logoDataUrl: string | null;
  };
  customer: {
    name: string;
    /** Primeiro nome, para o título ("Cantinho de Júlia"). */
    firstName: string;
  };
  points: {
    balance: number;
    /** Até quando os pontos valem; null se a loja não tem validade ou não há saldo. */
    expiresAt: string | null;
    /** Pontos para trocar por um doce (a estante cheia). */
    redeemCost: number;
    /** Pontos para raspar a sorte. */
    scratchCost: number;
  };
  /** Produtos que podem ser escolhidos como prêmio, por nome. */
  prizes: CustomerViewPrize[];
  /** Cupons pendentes (prêmios a retirar na loja), do mais antigo para o mais novo. */
  coupons: CustomerViewCoupon[];
  debt: {
    balanceCents: number;
    /** Pontos que entram na estante quando o que está em aberto for pago. */
    pendingPoints: number;
    /** Pix copia-e-cola com o valor em aberto, ou null sem dívida. */
    pixCode: string | null;
    /** Da mais antiga para a mais nova. */
    openSales: CustomerViewOpenSale[];
  };
  /** Do mais novo para o mais antigo (até 40). */
  history: CustomerViewEntry[];
}
