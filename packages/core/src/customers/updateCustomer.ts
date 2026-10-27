import type { DbClient } from '../db/client';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { customerColumns, toCustomer, type Customer } from './customer';
import { validateCustomerDetails, type CustomerDetailsInput } from './customerDetails';
import { fromCustomerDbError } from './dbHelpers';

/**
 * Substitui os dados do cliente (inclusive o PIN). Ao marcar o consentimento, o
 * servidor registra a data; ao desmarcar, apaga.
 * Erros: INVALID_INPUT, NOT_AUTHENTICATED, CUSTOMER_NOT_FOUND.
 */
export async function updateCustomer(
  db: DbClient,
  id: string,
  input: CustomerDetailsInput,
): Promise<Customer> {
  const details = validateCustomerDetails(input);
  await requireUserId(db);

  const { data, error } = await db
    .from('customers')
    .update(details)
    .eq('id', id)
    .select(customerColumns)
    .maybeSingle();

  if (error) throw fromCustomerDbError(error);
  if (!data) throw new CoreError('CUSTOMER_NOT_FOUND');
  return toCustomer(data);
}
