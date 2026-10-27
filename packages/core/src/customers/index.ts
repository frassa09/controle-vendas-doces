import type { DbClient } from '../db/client';
import type { Customer, CustomerSummary } from './customer';
import type { CustomerDetailsInput } from './customerDetails';
import { createCustomer } from './createCustomer';
import { getCustomer } from './getCustomer';
import { searchCustomers } from './searchCustomers';
import { updateCustomer } from './updateCustomer';
import { suggestPin } from './pin';

export type { Customer, CustomerSummary } from './customer';
export {
  CUSTOMER_LIMITS,
  type CustomerDetailsField,
  type CustomerDetailsInput,
} from './customerDetails';
export { formatWhatsApp, normalizeWhatsApp } from './whatsapp';

export interface CustomerOperations {
  /** Cadastra um cliente na loja; o token do link é gerado aqui. */
  createCustomer(input: CustomerDetailsInput): Promise<Customer>;
  /** Edita os dados do cliente, inclusive o PIN. */
  updateCustomer(id: string, input: CustomerDetailsInput): Promise<Customer>;
  /** Busca por nome ou referência (sem acento/maiúsculas). Vazio lista todos. */
  searchCustomers(query: string): Promise<CustomerSummary[]>;
  /** O perfil do cliente. */
  getCustomer(id: string): Promise<Customer>;
  /** Um PIN de 4 dígitos para sugerir no cadastro (não vai ao servidor). */
  suggestPin(): string;
}

export function createCustomerOperations(db: DbClient): CustomerOperations {
  return {
    createCustomer: (input) => createCustomer(db, input),
    updateCustomer: (id, input) => updateCustomer(db, id, input),
    searchCustomers: (query) => searchCustomers(db, query),
    getCustomer: (id) => getCustomer(db, id),
    suggestPin,
  };
}
