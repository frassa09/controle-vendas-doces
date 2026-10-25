import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { storeColumns, toStore, type Store } from './store';

/**
 * A loja de quem está logado, ou null se a pessoa ainda não tem loja
 * (primeiro acesso: criar loja ou, depois, entrar com convite).
 */
export async function getMyStore(db: DbClient): Promise<Store | null> {
  await requireUserId(db);

  // O RLS só deixa ver as lojas das quais o usuário é membro, e cada usuário
  // pertence a no máximo uma loja (índice único em store_members.user_id).
  const { data, error } = await db.from('stores').select(storeColumns).maybeSingle();

  if (error) throw fromDbError(error);
  return data ? toStore(data) : null;
}
