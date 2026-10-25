import type { Database } from '../db/database.types';

/** Uma loja, como as telas a enxergam. */
export interface Store {
  id: string;
  name: string;
  pixKey: string;
  /** Cidade do recebedor do Pix (exigida pelo Pix copia-e-cola). */
  city: string;
  createdAt: string;
}

export type StoreRow = Database['public']['Tables']['stores']['Row'];

/** Colunas lidas sempre que o core devolve uma loja. */
export const storeColumns = 'id, name, pix_key, city, created_at';

export function toStore(row: Omit<StoreRow, 'collection_template'>): Store {
  return {
    id: row.id,
    name: row.name,
    pixKey: row.pix_key,
    city: row.city,
    createdAt: row.created_at,
  };
}
