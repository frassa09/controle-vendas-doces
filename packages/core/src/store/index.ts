import type { DbClient } from '../db/client';
import { createInvite } from './createInvite';
import { createStore } from './createStore';
import { getMyStore } from './getMyStore';
import { getOpenInvite } from './getOpenInvite';
import type { StoreInvite } from './invite';
import { joinWithInvite } from './joinWithInvite';
import type { Store } from './store';
import type { StoreDetailsInput } from './storeDetails';
import { updateStoreDetails } from './updateStoreDetails';

export type { StoreInvite } from './invite';
export { INVITE_CODE_LENGTH, type InviteCodeField } from './inviteCode';
export type { Store } from './store';
export { STORE_LIMITS, type StoreDetailsField, type StoreDetailsInput } from './storeDetails';

export interface StoreOperations {
  /** Cria a loja com nome, chave Pix e cidade; quem cria vira membro. */
  createStore(input: StoreDetailsInput): Promise<Store>;
  /** A loja de quem está logado, ou null no primeiro acesso. */
  getMyStore(): Promise<Store | null>;
  /** Altera nome, chave Pix e cidade da loja; qualquer membro pode. */
  updateStoreDetails(input: StoreDetailsInput): Promise<Store>;
  /** Gera um código de convite de uso único (o anterior não usado deixa de valer). */
  createInvite(): Promise<StoreInvite>;
  /** O código de convite ainda não usado da loja, ou null. */
  getOpenInvite(): Promise<StoreInvite | null>;
  /** Entra na loja do código de convite, como membro com as mesmas permissões. */
  joinWithInvite(code: string): Promise<Store>;
}

export function createStoreOperations(db: DbClient): StoreOperations {
  return {
    createStore: (input) => createStore(db, input),
    getMyStore: () => getMyStore(db),
    updateStoreDetails: (input) => updateStoreDetails(db, input),
    createInvite: () => createInvite(db),
    getOpenInvite: () => getOpenInvite(db),
    joinWithInvite: (code) => joinWithInvite(db, code),
  };
}
