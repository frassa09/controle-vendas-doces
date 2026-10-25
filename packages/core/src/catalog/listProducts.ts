import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { productColumns, toProduct, type Product } from './product';

export interface ListProductsOptions {
  /** Só o que pode ser vendido agora (para a tela de venda). Padrão: todos. */
  activeOnly?: boolean;
}

const byName = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * O catálogo da loja: ativos primeiro, depois inativos, cada grupo em ordem
 * alfabética (sem diferenciar maiúsculas e acentos). Erros: NOT_AUTHENTICATED.
 */
export async function listProducts(
  db: DbClient,
  { activeOnly = false }: ListProductsOptions = {},
): Promise<Product[]> {
  await requireUserId(db);

  let query = db.from('products').select(productColumns);
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;

  if (error) throw fromDbError(error);
  return data
    .map(toProduct)
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        byName.compare(a.name, b.name) ||
        a.createdAt.localeCompare(b.createdAt),
    );
}
