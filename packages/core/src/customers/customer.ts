import type { Database } from '../db/database.types';

/** Um cliente da loja, como as telas a enxergam (perfil). */
export interface Customer {
  id: string;
  name: string;
  /** Normalizado: 55 + DDD + número, só dígitos (ex.: 5531998765432). */
  whatsapp: string;
  /** Onde encontrar o cliente, ou um apelido. Entra na busca. */
  reference: string | null;
  notes: string | null;
  /** PIN de 4 dígitos, legível para os membros porque precisa ser reenviado. */
  pin: string;
  /** Consentiu em receber mensagens e ter os dados guardados (LGPD). */
  consented: boolean;
  /** Quando consentiu (relógio do servidor), ou null. */
  consentAt: string | null;
  /** Segredo do link da página do cliente. Só membros da loja o leem. */
  linkToken: string;
  createdAt: string;
  updatedAt: string;
}

/** O que a lista e a busca mostram de cada cliente. */
export interface CustomerSummary {
  id: string;
  name: string;
  whatsapp: string;
  reference: string | null;
}

export type CustomerRow = Database['public']['Tables']['customers']['Row'];

/** Colunas lidas sempre que o core devolve um perfil. */
export const customerColumns =
  'id, name, whatsapp, reference, notes, pin, consented, consent_at, link_token, created_at, updated_at';

export const customerSummaryColumns = 'id, name, whatsapp, reference';

export function toCustomer(row: Omit<CustomerRow, 'store_id'>): Customer {
  return {
    id: row.id,
    name: row.name,
    whatsapp: row.whatsapp,
    reference: row.reference,
    notes: row.notes,
    pin: row.pin,
    consented: row.consented,
    consentAt: row.consent_at,
    linkToken: row.link_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCustomerSummary(
  row: Pick<CustomerRow, 'id' | 'name' | 'whatsapp' | 'reference'>,
): CustomerSummary {
  return { id: row.id, name: row.name, whatsapp: row.whatsapp, reference: row.reference };
}
