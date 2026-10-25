import { CoreError, type FieldErrors } from '../errors';
import type { PaymentMethod } from './sale';

export interface SaleItemInput {
  productId: string;
  /** Unidades (cada toque no produto soma 1). */
  quantity: number;
  /** Preço unitário cobrado, em centavos. Omitido: o preço padrão atual do produto. */
  unitPriceCents?: number;
}

/**
 * Como a venda é paga: "pago agora" (Pix ou dinheiro, gera o pagamento junto) ou
 * fiado (sem pagamento; entra no saldo devedor do cliente, por isso exige cliente).
 */
export type SalePaymentInput = { type: 'paidNow'; method: PaymentMethod } | { type: 'fiado' };

export interface RecordSaleInput {
  /** null = venda avulsa (sem cliente). */
  customerId: string | null;
  items: SaleItemInput[];
  payment: SalePaymentInput;
}

export type SaleField = 'items' | 'payment';

/** Limites espelhados nas constraints de sale_items e na função record_sale. */
export const SALE_LIMITS = {
  maxItems: 100,
  maxQuantity: 999,
  /** R$ 10.000,00 por unidade, como o preço do catálogo. */
  maxUnitPriceCents: 1_000_000,
  /** R$ 100.000,00 por venda. */
  maxTotalCents: 10_000_000,
} as const;

const methods: readonly string[] = ['pix', 'cash'] satisfies PaymentMethod[];

/**
 * A mensagem de erro para um preço unitário digitado na venda, ou null se ele
 * vale. A tela de venda usa para conferir o preço editado antes de aplicá-lo.
 */
export function unitPriceError(cents: number): string | null {
  if (!Number.isInteger(cents)) return 'Informe o preço, como 8,50.';
  if (cents <= 0) return 'O preço precisa ser maior que zero.';
  if (cents > SALE_LIMITS.maxUnitPriceCents) return 'Use no máximo R$ 10.000,00.';
  return null;
}

/** Valida a venda antes de ir ao servidor. Lança INVALID_INPUT com mensagens por campo. */
export function validateSale(input: RecordSaleInput): void {
  const fieldErrors: FieldErrors<SaleField> = {};
  const { items } = input;

  if (items.length === 0) {
    fieldErrors.items = 'Toque em pelo menos um produto.';
  } else if (items.length > SALE_LIMITS.maxItems) {
    fieldErrors.items = `Use no máximo ${String(SALE_LIMITS.maxItems)} itens por venda.`;
  } else {
    let total = 0;
    for (const [index, item] of items.entries()) {
      const n = String(index + 1);
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > SALE_LIMITS.maxQuantity
      ) {
        fieldErrors.items = `A quantidade do item ${n} precisa ser de 1 a ${String(SALE_LIMITS.maxQuantity)}.`;
        break;
      }
      if (item.unitPriceCents !== undefined) {
        const priceError = unitPriceError(item.unitPriceCents);
        if (priceError) {
          fieldErrors.items = `Item ${n}: ${priceError.charAt(0).toLowerCase()}${priceError.slice(1)}`;
          break;
        }
        total += item.unitPriceCents * item.quantity;
      }
    }
    if (!fieldErrors.items && total > SALE_LIMITS.maxTotalCents) {
      fieldErrors.items = 'O total passa de R$ 100.000,00. Divida em mais de uma venda.';
    }
  }

  const { payment } = input;
  if (payment.type === 'fiado') {
    if (input.customerId === null) fieldErrors.payment = 'Escolha o cliente para vender fiado.';
  } else if ((payment.type as string) !== 'paidNow' || !methods.includes(payment.method)) {
    fieldErrors.payment = 'Escolha Pix ou dinheiro.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CoreError<SaleField>('INVALID_INPUT', { fieldErrors });
  }
}
