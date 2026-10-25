import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { isProductId, productColumns, productNotFound, toProduct, type Product } from './product';

/**
 * Ativa (volta à venda) ou desativa (sai da venda, continua no catálogo e no
 * histórico) um produto. Erros: NOT_AUTHENTICATED, NOT_FOUND.
 */
export async function setProductActive(
  db: DbClient,
  id: string,
  isActive: boolean,
): Promise<Product> {
  await requireUserId(db);
  if (!isProductId(id)) throw productNotFound();

  const { data, error } = await db
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)
    .select(productColumns)
    .maybeSingle();

  if (error) throw fromDbError(error);
  if (!data) throw productNotFound();
  return toProduct(data);
}
