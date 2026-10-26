import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import type { ScratchPlay } from './scratchPlay';

export interface ListScratchPlaysOptions {
  /** Só as jogadas deste cliente; sem ele, todas da loja. */
  customerId?: string;
}

/**
 * Jogadas da raspadinha, da mais antiga para a mais nova.
 * Erros: NOT_AUTHENTICATED, CUSTOMER_NOT_FOUND (id inválido).
 */
export async function listScratchPlays(
  db: DbClient,
  options: ListScratchPlaysOptions = {},
): Promise<ScratchPlay[]> {
  await requireUserId(db);
  const { customerId } = options;
  if (customerId !== undefined && !isUuid(customerId)) throw new CoreError('CUSTOMER_NOT_FOUND');

  let query = db
    .from('scratch_plays')
    .select('id, customer_id, format, won, cost, win_percent, created_at');
  if (customerId !== undefined) query = query.eq('customer_id', customerId);
  const { data, error } = await query
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw fromDbError(error);
  return data.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    format: row.format === 'match_three' ? 'match_three' : 'five_spots',
    won: row.won,
    cost: row.cost,
    winPercent: row.win_percent,
    createdAt: row.created_at,
  }));
}
