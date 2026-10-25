import type { DbClient } from '../db/client';
import { createStore } from './createStore';
import { getMyStore } from './getMyStore';
import type { Store } from './store';
import type { StoreDetailsInput } from './storeDetails';

export type { Store } from './store';
export { STORE_LIMITS, type StoreDetailsField, type StoreDetailsInput } from './storeDetails';

export interface StoreOperations {
  /** Cria a loja com nome, chave Pix e cidade; quem cria vira membro. */
  createStore(input: StoreDetailsInput): Promise<Store>;
  /** A loja de quem está logado, ou null no primeiro acesso. */
  getMyStore(): Promise<Store | null>;
}

export function createStoreOperations(db: DbClient): StoreOperations {
  return {
    createStore: (input) => createStore(db, input),
    getMyStore: () => getMyStore(db),
  };
}
