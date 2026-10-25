import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { customerSummaryColumns, toCustomerSummary, type CustomerSummary } from './customer';

/**
 * Clientes cujo nome ou referência contém o texto, sem diferenciar maiúsculas nem
 * acentos, em ordem alfabética. Texto vazio lista todos.
 */
export async function searchCustomers(db: DbClient, query: string): Promise<CustomerSummary[]> {
  await requireUserId(db);

  const { data, error } = await db
    .rpc('search_customers', { p_query: query })
    .select(customerSummaryColumns);

  if (error) throw fromDbError(error);
  return data.map(toCustomerSummary);
}
