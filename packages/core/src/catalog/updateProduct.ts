import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { isProductId, productColumns, productNotFound, toProduct, type Product } from './product';
import { validateProduct, type ProductInput } from './productDetails';

/**
 * Substitui os dados do produto (nome, preço, pontos, prêmio, combo). Campos
 * opcionais omitidos voltam ao padrão, como no cadastro. Não muda se está ativo.
 * Vendas já registradas guardam cópia do preço e dos pontos, então não mudam.
 * Erros: INVALID_INPUT, NOT_AUTHENTICATED, PRODUCT_NOT_FOUND.
 */
export async function updateProduct(
  db: DbClient,
  id: string,
  input: ProductInput,
): Promise<Product> {
  const details = validateProduct(input);
  await requireUserId(db);
  if (!isProductId(id)) throw productNotFound();

  // O RLS só deixa alterar produtos da própria loja; de outra loja, nada muda.
  const { data, error } = await db
    .from('products')
    .update({
      name: details.name,
      price_cents: details.priceCents,
      points: details.points,
      can_be_prize: details.canBePrize,
      is_combo: details.isCombo,
    })
    .eq('id', id)
    .select(productColumns)
    .maybeSingle();

  if (error) throw fromDbError(error);
  if (!data) throw productNotFound();
  return toProduct(data);
}
