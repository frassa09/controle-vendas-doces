import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireStoreId } from '../db/session';
import { validateStoreLogo } from './storeBranding';

/**
 * Troca (ou remove, com null) o logo da loja: uma imagem pequena como data URL.
 * Erros: INVALID_INPUT (fieldErrors.logo), NOT_AUTHENTICATED, FORBIDDEN.
 */
export async function setStoreLogo(db: DbClient, logo: string | null): Promise<void> {
  const value = validateStoreLogo(logo);
  const storeId = await requireStoreId(db);

  const { error } = await db.from('stores').update({ logo_data: value }).eq('id', storeId);
  if (error) throw fromDbError(error);
}

/** O logo da loja (data URL) ou null. Erros: NOT_AUTHENTICATED, FORBIDDEN. */
export async function getStoreLogo(db: DbClient): Promise<string | null> {
  const storeId = await requireStoreId(db);

  const { data, error } = await db.from('stores').select('logo_data').eq('id', storeId).single();
  if (error) throw fromDbError(error);
  return data.logo_data;
}
