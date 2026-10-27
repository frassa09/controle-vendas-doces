import type { Database } from '../db/database.types';
import { CoreError } from '../errors';

/** Um produto ou combo do cardápio, como as telas o enxergam. */
export interface Product {
  id: string;
  name: string;
  /** Preço padrão em centavos. */
  priceCents: number;
  /** Pontos que cada unidade gera quando a venda é quitada. */
  points: number;
  /** Pode ser escolhido como prêmio no resgate e na raspadinha. */
  canBePrize: boolean;
  /** Inativo não aparece na venda, mas continua no catálogo e no histórico. */
  isActive: boolean;
  /** Combo (ex.: "3 brownies por R$ 8"): um produto com preço e pontos próprios. */
  isCombo: boolean;
  createdAt: string;
}

export type ProductRow = Database['public']['Tables']['products']['Row'];

/** Colunas lidas sempre que o core devolve um produto. */
export const productColumns =
  'id, name, price_cents, points, can_be_prize, is_active, is_combo, created_at';

export function toProduct(row: Omit<ProductRow, 'store_id'>): Product {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    points: row.points,
    canBePrize: row.can_be_prize,
    isActive: row.is_active,
    isCombo: row.is_combo,
    createdAt: row.created_at,
  };
}

export function productNotFound(): CoreError {
  return new CoreError('PRODUCT_NOT_FOUND');
}

/** Um id que não é uuid nunca existe (e evita o erro de sintaxe do Postgres). */
export function isProductId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
