import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireStoreId } from '../db/session';
import { storeColumns, toStore, type Store } from './store';
import { validateStoreBranding, type StoreBrandingInput } from './storeBranding';

/**
 * Altera cor principal e texto de boas-vindas da loja. Qualquer membro pode.
 * Erros: INVALID_INPUT (campos), NOT_AUTHENTICATED, FORBIDDEN (sem loja).
 */
export async function updateStoreBranding(db: DbClient, input: StoreBrandingInput): Promise<Store> {
  const branding = validateStoreBranding(input);
  const storeId = await requireStoreId(db);

  const { data, error } = await db
    .from('stores')
    .update({ brand_color: branding.brandColor, welcome_text: branding.welcomeText })
    .eq('id', storeId)
    .select(storeColumns)
    .single();
  if (error) throw fromDbError(error);
  return toStore(data);
}
