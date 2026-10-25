import { CoreError, type FieldErrors } from '../errors';
import { normalizeWhatsApp } from './whatsapp';

/** Dados do cliente que o membro informa no cadastro e na edição. */
export interface CustomerDetailsInput {
  name: string;
  /** Telefone com DDD, em qualquer formato (ex.: "(31) 99876-5432"). */
  whatsapp: string;
  reference?: string | null;
  notes?: string | null;
  /** 4 dígitos; use customers.suggestPin() para a sugestão inicial. */
  pin: string;
  /** O cliente consentiu (LGPD). A data é registrada pelo servidor. */
  consented: boolean;
}

export type CustomerDetailsField = 'name' | 'whatsapp' | 'reference' | 'notes' | 'pin';

/** Limites espelhados nas constraints da tabela public.customers. */
export const CUSTOMER_LIMITS = {
  name: 80,
  reference: 80,
  notes: 500,
  pin: 4,
} as const;

export interface CustomerDetails {
  name: string;
  whatsapp: string;
  reference: string | null;
  notes: string | null;
  pin: string;
  consented: boolean;
}

function tooLong(limit: number): string {
  return `Use no máximo ${String(limit)} caracteres.`;
}

/**
 * Normaliza (espaços nas pontas, telefone só com dígitos, opcionais vazios como null)
 * e valida os dados do cliente. Lança INVALID_INPUT com uma mensagem por campo.
 */
export function validateCustomerDetails(input: CustomerDetailsInput): CustomerDetails {
  const name = input.name.trim();
  const reference = input.reference?.trim() ?? '';
  const notes = input.notes?.trim() ?? '';
  const pin = input.pin.trim();
  const whatsappText = input.whatsapp.trim();
  const whatsapp = normalizeWhatsApp(whatsappText);
  const fieldErrors: FieldErrors<CustomerDetailsField> = {};

  if (name === '') fieldErrors.name = 'Informe o nome do cliente.';
  else if (name.length > CUSTOMER_LIMITS.name) fieldErrors.name = tooLong(CUSTOMER_LIMITS.name);

  if (whatsappText === '') fieldErrors.whatsapp = 'Informe o WhatsApp do cliente.';
  else if (!whatsapp) {
    fieldErrors.whatsapp = 'Confira o número: DDD e celular, ex.: (31) 99876-5432.';
  }

  if (reference.length > CUSTOMER_LIMITS.reference) {
    fieldErrors.reference = tooLong(CUSTOMER_LIMITS.reference);
  }
  if (notes.length > CUSTOMER_LIMITS.notes) fieldErrors.notes = tooLong(CUSTOMER_LIMITS.notes);
  if (!/^\d{4}$/.test(pin)) fieldErrors.pin = 'O PIN tem 4 números.';

  if (Object.keys(fieldErrors).length > 0 || !whatsapp) {
    throw new CoreError<CustomerDetailsField>('INVALID_INPUT', { fieldErrors });
  }
  return {
    name,
    whatsapp,
    reference: reference === '' ? null : reference,
    notes: notes === '' ? null : notes,
    pin,
    consented: input.consented,
  };
}
