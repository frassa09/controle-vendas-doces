import { CoreError, type FieldErrors } from '../errors';

/** Dados da loja que o dono informa (na criação e, depois, nas configurações). */
export interface StoreDetailsInput {
  name: string;
  pixKey: string;
  city: string;
}

export type StoreDetailsField = keyof StoreDetailsInput;

/** Limites espelhados nas constraints da tabela public.stores. */
export const STORE_LIMITS = {
  name: 80,
  /** Limite do BR Code para a chave Pix. */
  pixKey: 77,
  city: 60,
} as const satisfies Record<StoreDetailsField, number>;

const requiredMessages: Record<StoreDetailsField, string> = {
  name: 'Informe o nome da loja.',
  pixKey: 'Informe a chave Pix da loja.',
  city: 'Informe a cidade da loja.',
};

/**
 * Normaliza (remove espaços nas pontas) e valida os dados da loja.
 * Lança INVALID_INPUT com uma mensagem por campo inválido.
 */
export function validateStoreDetails(input: StoreDetailsInput): StoreDetailsInput {
  const details: StoreDetailsInput = {
    name: input.name.trim(),
    pixKey: input.pixKey.trim(),
    city: input.city.trim(),
  };
  const fieldErrors: FieldErrors<StoreDetailsField> = {};

  for (const field of Object.keys(details) as StoreDetailsField[]) {
    const value = details[field];
    if (value === '') fieldErrors[field] = requiredMessages[field];
    else if (value.length > STORE_LIMITS[field]) {
      fieldErrors[field] = `Use no máximo ${String(STORE_LIMITS[field])} caracteres.`;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CoreError<StoreDetailsField>('INVALID_INPUT', { fieldErrors });
  }
  return details;
}
