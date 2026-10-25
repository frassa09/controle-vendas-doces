import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { toStoreInvite, type StoreInvite } from './invite';

/**
 * Gera um código de convite de uso único para a loja de quem está logado.
 * O código ainda não usado que existir deixa de valer.
 * Erros: NOT_AUTHENTICATED, FORBIDDEN (sem loja).
 */
export async function createInvite(db: DbClient): Promise<StoreInvite> {
  await requireUserId(db);

  const { data, error } = await db.rpc('create_store_invite');

  if (error) throw fromDbError(error);
  return toStoreInvite(data);
}
