import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { isProductId, productColumns, productNotFound, toProduct, type Product } from './product';

/** Um produto da loja, ativo ou não. Erros: NOT_AUTHENTICATED, PRODUCT_NOT_FOUND. */
export async function getProduct(db: DbClient, id: string): Promise<Product> {
  await requireUserId(db);
  if (!isProductId(id)) throw productNotFound();

  const { data, error } = await db
    .from('products')
    .select(productColumns)
    .eq('id', id)
    .maybeSingle();

  if (error) throw fromDbError(error);
  if (!data) throw productNotFound();
  return toProduct(data);
}
