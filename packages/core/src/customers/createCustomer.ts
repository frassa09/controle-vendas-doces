import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireStoreId } from '../db/session';
import { customerColumns, toCustomer, type Customer } from './customer';
import { validateCustomerDetails, type CustomerDetailsInput } from './customerDetails';

/**
 * Cadastra um cliente na loja de quem está logado. O token do link nasce no banco.
 * Erros: INVALID_INPUT (campos), NOT_AUTHENTICATED, FORBIDDEN (sem loja).
 */
export async function createCustomer(db: DbClient, input: CustomerDetailsInput): Promise<Customer> {
  const details = validateCustomerDetails(input);
  const storeId = await requireStoreId(db);

  const { data, error } = await db
    .from('customers')
    .insert({ store_id: storeId, ...details })
    .select(customerColumns)
    .single();

  if (error) throw fromDbError(error);
  return toCustomer(data);
}
