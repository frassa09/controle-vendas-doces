import type { DbClient } from '../db/client';
import {
  buildCollectionMessage,
  type CollectionMessage,
  type CollectionMessageSettings,
} from './collectionMessage';
import {
  getCollectionTemplate,
  setCollectionTemplate,
  type CollectionTemplate,
} from './collectionTemplate';
import { getCollectionQueue } from './getCollectionQueue';
import type { CollectionQueueItem, CollectionQueueOptions } from './queue';
import { recordCollection, type Collection } from './recordCollection';

export { buildWhatsAppUrl, type CollectionMessage } from './collectionMessage';
export type { CollectionTemplate } from './collectionTemplate';
export { buildPixCopyAndPaste, crc16, normalizePixKey, type PixField, type PixInput } from './pix';
export {
  collectionRangeOf,
  type CollectionQueueItem,
  type CollectionQueueOptions,
  type CollectionRange,
} from './queue';
export type { Collection } from './recordCollection';
export {
  COLLECTION_TEMPLATE_MAX,
  COLLECTION_VARIABLES,
  DEFAULT_COLLECTION_TEMPLATE,
  type CollectionVariable,
} from './template';

export interface CollectionOperations {
  /** Os devedores da loja, da dívida mais antiga para a mais nova (filtro por faixa de atraso). */
  getQueue(options?: CollectionQueueOptions): Promise<CollectionQueueItem[]>;
  /** A mensagem de cobrança do cliente e o link do WhatsApp que a abre. */
  buildMessage(customerId: string): Promise<CollectionMessage>;
  /** Registra que a cobrança foi enviada ao cliente. */
  recordSent(customerId: string): Promise<Collection>;
  /** O texto-modelo de cobrança da loja (padrão se nunca editado). */
  getTemplate(): Promise<CollectionTemplate>;
  /** Salva o texto-modelo; `null` volta ao padrão. */
  setTemplate(template: string | null): Promise<CollectionTemplate>;
}

export function createCollectionOperations(
  db: DbClient,
  settings: CollectionMessageSettings,
): CollectionOperations {
  return {
    getQueue: (options) => getCollectionQueue(db, options),
    buildMessage: (customerId) => buildCollectionMessage(db, customerId, settings),
    recordSent: (customerId) => recordCollection(db, customerId),
    getTemplate: () => getCollectionTemplate(db),
    setTemplate: (template) => setCollectionTemplate(db, template),
  };
}
