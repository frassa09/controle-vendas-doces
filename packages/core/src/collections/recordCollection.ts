import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';

/** Uma cobrança enviada. */
export interface Collection {
  id: string;
  customerId: string;
  /** Saldo devedor do cliente no momento do envio. */
  amountCents: number;
  createdAt: string;
}

/**
 * Registra que a cobrança foi enviada ao cliente (guarda o saldo da hora).
 * Erros: NOT_AUTHENTICATED, FORBIDDEN, CUSTOMER_NOT_FOUND, NO_DEBT.
 */
export async function recordCollection(db: DbClient, customerId: string): Promise<Collection> {
  await requireUserId(db);
  if (!isUuid(customerId)) throw new CoreError('CUSTOMER_NOT_FOUND');

  const { data, error } = await db.rpc('record_collection', { p_customer_id: customerId });
  if (error) throw fromDbError(error);
  const row = data[0];
  if (!row) throw new CoreError('UNEXPECTED');
  return { id: row.id, customerId, amountCents: row.amount_cents, createdAt: row.created_at };
}
