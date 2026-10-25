import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { storeColumns, toStore, type Store } from './store';
import { validateStoreDetails, type StoreDetailsInput } from './storeDetails';

/**
 * Altera nome, chave Pix e cidade da loja de quem está logado. Qualquer membro
 * pode, com as mesmas regras da criação.
 * Erros: INVALID_INPUT (campos), NOT_AUTHENTICATED, FORBIDDEN (sem loja).
 */
export async function updateStoreDetails(db: DbClient, input: StoreDetailsInput): Promise<Store> {
  const details = validateStoreDetails(input);
  const userId = await requireUserId(db);

  const membership = await db
    .from('store_members')
    .select('store_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (membership.error) throw fromDbError(membership.error);
  if (!membership.data) throw new CoreError('FORBIDDEN');

  const { data, error } = await db
    .from('stores')
    .update({ name: details.name, pix_key: details.pixKey, city: details.city })
    .eq('id', membership.data.store_id)
    .select(storeColumns)
    .single();

  if (error) throw fromDbError(error);
  return toStore(data);
}
