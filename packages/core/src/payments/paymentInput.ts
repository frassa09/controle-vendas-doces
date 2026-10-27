import { CoreError, type FieldErrors } from '../errors';
import type { PaymentMethod } from '../sales/sale';

export interface RecordPaymentInput {
  customerId: string;
  /** Valor recebido, em centavos. Pode ser só uma parte do saldo devedor. */
  amountCents: number;
  method: PaymentMethod;
}

export type PaymentField = 'amountCents' | 'method';

export const PAYMENT_LIMITS = {
  /** R$ 1.000.000,00 por pagamento. */
  maxAmountCents: 100_000_000,
} as const;

const methods: readonly string[] = ['pix', 'cash'] satisfies PaymentMethod[];

/** Valida o pagamento antes de ir ao servidor. Lança INVALID_INPUT com mensagens por campo. */
export function validatePayment(input: RecordPaymentInput): void {
  const fieldErrors: FieldErrors<PaymentField> = {};
  const { amountCents } = input;

  if (!Number.isInteger(amountCents)) {
    fieldErrors.amountCents = 'Informe o valor, como 8,50.';
  } else if (amountCents <= 0) {
    fieldErrors.amountCents = 'O valor precisa ser maior que zero.';
  } else if (amountCents > PAYMENT_LIMITS.maxAmountCents) {
    fieldErrors.amountCents = 'Use no máximo R$ 1.000.000,00.';
  }

  if (!methods.includes(input.method)) {
    fieldErrors.method = 'Escolha Pix ou dinheiro.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CoreError<PaymentField>('INVALID_INPUT', { fieldErrors });
  }
}
