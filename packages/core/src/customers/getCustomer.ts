import type { DbClient } from '../db/client';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { customerColumns, toCustomer, type Customer } from './customer';
import { fromCustomerDbError } from './dbHelpers';

/** O perfil do cliente. Erros: NOT_AUTHENTICATED, CUSTOMER_NOT_FOUND. */
export async function getCustomer(db: DbClient, id: string): Promise<Customer> {
  await requireUserId(db);

  const { data, error } = await db
    .from('customers')
    .select(customerColumns)
    .eq('id', id)
    .maybeSingle();

  if (error) throw fromCustomerDbError(error);
  if (!data) throw new CoreError('CUSTOMER_NOT_FOUND');
  return toCustomer(data);
}
