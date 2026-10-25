import type { Database } from '../db/database.types';

/** Uma loja, como as telas a enxergam. */
export interface Store {
  id: string;
  name: string;
  pixKey: string;
  /** Cidade do recebedor do Pix (exigida pelo Pix copia-e-cola). */
  city: string;
  /** Cor principal (#RRGGBB) ou null para a cor padrão. */
  brandColor: string | null;
  /** Texto de boas-vindas da página do cliente, ou null para a frase padrão. */
  welcomeText: string | null;
  createdAt: string;
}

export type StoreRow = Database['public']['Tables']['stores']['Row'];

/** Colunas lidas sempre que o core devolve uma loja (o logo, pesado, fica de fora). */
export const storeColumns = 'id, name, pix_key, city, brand_color, welcome_text, created_at';

export function toStore(
  row: Pick<
    StoreRow,
    'id' | 'name' | 'pix_key' | 'city' | 'brand_color' | 'welcome_text' | 'created_at'
  >,
): Store {
  return {
    id: row.id,
    name: row.name,
    pixKey: row.pix_key,
    city: row.city,
    brandColor: row.brand_color,
    welcomeText: row.welcome_text,
    createdAt: row.created_at,
  };
}
