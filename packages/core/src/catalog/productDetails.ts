import { CoreError, type FieldErrors } from '../errors';

/** O que o membro informa ao cadastrar ou editar um produto ou combo. */
export interface ProductInput {
  name: string;
  /** Preço padrão em centavos (use parseCents para converter o que foi digitado). */
  priceCents: number;
  /** Pontos gerados por unidade. Padrão 0. */
  points?: number;
  /** Pode ser prêmio. Padrão não. */
  canBePrize?: boolean;
  /** É combo. Padrão não. */
  isCombo?: boolean;
}

export type ProductField = 'name' | 'priceCents' | 'points';

export interface ProductDetails {
  name: string;
  priceCents: number;
  points: number;
  canBePrize: boolean;
  isCombo: boolean;
}

/** Limites espelhados nas constraints da tabela public.products. */
export const PRODUCT_LIMITS = {
  name: 80,
  /** R$ 10.000,00 */
  maxPriceCents: 1_000_000,
  maxPoints: 9999,
} as const;

/**
 * Normaliza (nome sem espaços nas pontas, padrões preenchidos) e valida.
 * Lança INVALID_INPUT com uma mensagem por campo inválido.
 */
export function validateProduct(input: ProductInput): ProductDetails {
  const details: ProductDetails = {
    name: input.name.trim(),
    priceCents: input.priceCents,
    points: input.points ?? 0,
    canBePrize: input.canBePrize ?? false,
    isCombo: input.isCombo ?? false,
  };
  const fieldErrors: FieldErrors<ProductField> = {};

  if (details.name === '') fieldErrors.name = 'Informe o nome do produto.';
  else if (details.name.length > PRODUCT_LIMITS.name) {
    fieldErrors.name = `Use no máximo ${String(PRODUCT_LIMITS.name)} caracteres.`;
  }

  if (!Number.isInteger(details.priceCents)) {
    fieldErrors.priceCents = 'Informe o preço, como 8,50.';
  } else if (details.priceCents <= 0) {
    fieldErrors.priceCents = 'O preço precisa ser maior que zero.';
  } else if (details.priceCents > PRODUCT_LIMITS.maxPriceCents) {
    fieldErrors.priceCents = 'Use no máximo R$ 10.000,00.';
  }

  if (!Number.isInteger(details.points)) {
    fieldErrors.points = 'Use um número inteiro de pontos.';
  } else if (details.points < 0) {
    fieldErrors.points = 'Os pontos não podem ser negativos.';
  } else if (details.points > PRODUCT_LIMITS.maxPoints) {
    fieldErrors.points = `Use no máximo ${String(PRODUCT_LIMITS.maxPoints)} pontos.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CoreError<ProductField>('INVALID_INPUT', { fieldErrors });
  }
  return details;
}
