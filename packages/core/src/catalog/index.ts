import type { DbClient } from '../db/client';
import { createProduct } from './createProduct';
import { getProduct } from './getProduct';
import { listProducts, type ListProductsOptions } from './listProducts';
import type { Product } from './product';
import type { ProductInput } from './productDetails';
import { setProductActive } from './setProductActive';
import { updateProduct } from './updateProduct';

export type { Product } from './product';
export type { ListProductsOptions } from './listProducts';
export { PRODUCT_LIMITS, type ProductField, type ProductInput } from './productDetails';

export interface CatalogOperations {
  /** Cadastra um produto ou combo (pontos padrão 0, fora dos prêmios, ativo). */
  createProduct(input: ProductInput): Promise<Product>;
  /** Substitui nome, preço, pontos e marcações; não mexe em vendas antigas. */
  updateProduct(id: string, input: ProductInput): Promise<Product>;
  /** Um produto da loja, ativo ou inativo. */
  getProduct(id: string): Promise<Product>;
  /** Ativos primeiro, depois inativos; `activeOnly` para a tela de venda. */
  listProducts(options?: ListProductsOptions): Promise<Product[]>;
  /** Volta o produto à venda. */
  activateProduct(id: string): Promise<Product>;
  /** Tira o produto da venda sem perder o histórico. */
  deactivateProduct(id: string): Promise<Product>;
}

export function createCatalogOperations(db: DbClient): CatalogOperations {
  return {
    createProduct: (input) => createProduct(db, input),
    updateProduct: (id, input) => updateProduct(db, id, input),
    getProduct: (id) => getProduct(db, id),
    listProducts: (options) => listProducts(db, options),
    activateProduct: (id) => setProductActive(db, id, true),
    deactivateProduct: (id) => setProductActive(db, id, false),
  };
}
