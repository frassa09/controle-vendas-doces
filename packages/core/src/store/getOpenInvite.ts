import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { inviteColumns, toStoreInvite, type StoreInvite } from './invite';

/** O código de convite da loja que ainda não foi usado, ou null se não há. */
export async function getOpenInvite(db: DbClient): Promise<StoreInvite | null> {
  await requireUserId(db);

  // O RLS só mostra os convites da loja de quem está logado, e cada loja tem no
  // máximo um código disponível (índice único parcial).
  const { data, error } = await db
    .from('store_invites')
    .select(inviteColumns)
    .is('used_at', null)
    .maybeSingle();

  if (error) throw fromDbError(error);
  return data ? toStoreInvite(data) : null;
}
