import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { toStore, type Store } from './store';
import { validateStoreDetails, type StoreDetailsInput } from './storeDetails';

/**
 * Cria a loja e torna quem está logado o seu primeiro membro.
 * Erros: INVALID_INPUT (campos), NOT_AUTHENTICATED, ALREADY_HAS_STORE.
 */
export async function createStore(db: DbClient, input: StoreDetailsInput): Promise<Store> {
  const details = validateStoreDetails(input);
  await requireUserId(db);

  const { data, error } = await db.rpc('create_store', {
    p_name: details.name,
    p_pix_key: details.pixKey,
    p_city: details.city,
  });

  if (error) {
    // Duas criações simultâneas do mesmo usuário esbarram no índice único de membros.
    if (error.code === '23505') throw new CoreError('ALREADY_HAS_STORE', { cause: error });
    throw fromDbError(error);
  }
  return toStore(data);
}
