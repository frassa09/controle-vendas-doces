import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireStoreId } from '../db/session';
import { DEFAULT_COLLECTION_TEMPLATE, validateCollectionTemplate } from './template';

/** O texto-modelo de cobrança da loja. */
export interface CollectionTemplate {
  template: string;
  /** Verdadeiro enquanto a loja usa o texto padrão. */
  isDefault: boolean;
}

/** O texto-modelo da loja (o padrão se ela nunca editou). Erros: NOT_AUTHENTICATED, FORBIDDEN. */
export async function getCollectionTemplate(db: DbClient): Promise<CollectionTemplate> {
  const storeId = await requireStoreId(db);
  const { data, error } = await db
    .from('stores')
    .select('collection_template')
    .eq('id', storeId)
    .single();
  if (error) throw fromDbError(error);
  return toCollectionTemplate(data.collection_template);
}

/**
 * Salva o texto-modelo da loja; `null` volta ao texto padrão.
 * Erros: INVALID_INPUT (`fieldErrors.template`), NOT_AUTHENTICATED, FORBIDDEN.
 */
export async function setCollectionTemplate(
  db: DbClient,
  template: string | null,
): Promise<CollectionTemplate> {
  const value = template === null ? null : validateCollectionTemplate(template);
  const storeId = await requireStoreId(db);
  const { data, error } = await db
    .from('stores')
    .update({ collection_template: value })
    .eq('id', storeId)
    .select('collection_template')
    .single();
  if (error) throw fromDbError(error);
  return toCollectionTemplate(data.collection_template);
}

export function toCollectionTemplate(stored: string | null): CollectionTemplate {
  return stored === null
    ? { template: DEFAULT_COLLECTION_TEMPLATE, isDefault: true }
    : { template: stored, isDefault: false };
}
