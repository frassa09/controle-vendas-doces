import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireStoreId } from '../db/session';
import { productColumns, toProduct, type Product } from './product';
import { validateProduct, type ProductInput } from './productDetails';

/**
 * Cadastra um produto ou combo na loja de quem está logado, já ativo.
 * Erros: INVALID_INPUT (campos), NOT_AUTHENTICATED, FORBIDDEN (sem loja).
 */
export async function createProduct(db: DbClient, input: ProductInput): Promise<Product> {
  const details = validateProduct(input);
  const storeId = await requireStoreId(db);

  const { data, error } = await db
    .from('products')
    .insert({
      store_id: storeId,
      name: details.name,
      price_cents: details.priceCents,
      points: details.points,
      can_be_prize: details.canBePrize,
      is_combo: details.isCombo,
    })
    .select(productColumns)
    .single();

  if (error) throw fromDbError(error);
  return toProduct(data);
}
