import type { DbClient } from '../db/client';
import { createInvite } from './createInvite';
import { createStore } from './createStore';
import { getMyStore } from './getMyStore';
import { getOpenInvite } from './getOpenInvite';
import type { StoreInvite } from './invite';
import { joinWithInvite } from './joinWithInvite';
import type { Store } from './store';
import type { RewardSettingsInput } from './rewardSettings';
import type { StoreBrandingInput } from './storeBranding';
import type { StoreDetailsInput } from './storeDetails';
import { getStoreLogo, setStoreLogo } from './storeLogo';
import { updateStoreBranding } from './updateStoreBranding';
import { updateRewardSettings } from './updateRewardSettings';
import { updateStoreDetails } from './updateStoreDetails';

export type { StoreInvite } from './invite';
export { INVITE_CODE_LENGTH, type InviteCodeField } from './inviteCode';
export {
  REWARD_LIMITS,
  type RewardSettingsField,
  type RewardSettingsInput,
} from './rewardSettings';
export type { Store } from './store';
export { BRANDING_LIMITS, type StoreBrandingField, type StoreBrandingInput } from './storeBranding';
export { STORE_LIMITS, type StoreDetailsField, type StoreDetailsInput } from './storeDetails';

export interface StoreOperations {
  /** Cria a loja com nome, chave Pix e cidade; quem cria vira membro. */
  createStore(input: StoreDetailsInput): Promise<Store>;
  /** A loja de quem está logado, ou null no primeiro acesso. */
  getMyStore(): Promise<Store | null>;
  /** Altera nome, chave Pix e cidade da loja; qualquer membro pode. */
  updateStoreDetails(input: StoreDetailsInput): Promise<Store>;
  /** Altera cor principal e texto de boas-vindas (null = padrão); qualquer membro pode. */
  updateStoreBranding(input: StoreBrandingInput): Promise<Store>;
  /** Altera as regras de fidelidade (custo do resgate direto); qualquer membro pode. */
  updateRewardSettings(input: RewardSettingsInput): Promise<Store>;
  /** Troca o logo (data URL png/jpeg/webp pequeno) ou remove com null. */
  setStoreLogo(logo: string | null): Promise<void>;
  /** O logo da loja (data URL) ou null. */
  getStoreLogo(): Promise<string | null>;
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
    updateStoreBranding: (input) => updateStoreBranding(db, input),
    updateRewardSettings: (input) => updateRewardSettings(db, input),
    setStoreLogo: (logo) => setStoreLogo(db, logo),
    getStoreLogo: () => getStoreLogo(db),
    createInvite: () => createInvite(db),
    getOpenInvite: () => getOpenInvite(db),
    joinWithInvite: (code) => joinWithInvite(db, code),
  };
}
