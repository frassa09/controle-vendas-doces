import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { collectionRangeOf, type CollectionQueueItem, type CollectionQueueOptions } from './queue';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Todos os devedores da loja, da dívida mais antiga para a mais nova, opcionalmente
 * só os de uma faixa de atraso. Saldo e idade vêm da alocação FIFO do banco.
 * Erros: NOT_AUTHENTICATED.
 */
export async function getCollectionQueue(
  db: DbClient,
  options: CollectionQueueOptions = {},
  now: Date = new Date(),
): Promise<CollectionQueueItem[]> {
  await requireUserId(db);

  const { data, error } = await db.rpc('list_collection_queue');
  if (error) throw fromDbError(error);

  const range = options.range ?? 'all';
  return data
    .map((row): CollectionQueueItem => ({
      customerId: row.customer_id,
      name: row.name,
      whatsapp: row.whatsapp,
      balanceCents: row.balance_cents,
      debtSince: row.debt_since,
      daysOpen: Math.max(0, Math.floor((now.getTime() - Date.parse(row.debt_since)) / DAY_MS)),
      lastCollectionAt: row.last_collection_at,
    }))
    .filter((item) => range === 'all' || collectionRangeOf(item.daysOpen) === range);
}
