import type { DbClient } from '../db/client';
import { claimScratchPrize } from './claimScratchPrize';
import type {
  ClaimScratchPrizeInput,
  ClaimScratchPrizeResult,
  CustomerView,
  PlayScratchInput,
  RedeemRewardInput,
  RedeemRewardResult,
  ScratchPlayResult,
} from './customerView';
import { getCustomerView } from './getCustomerView';
import { playScratch } from './playScratch';
import { redeemReward } from './redeemReward';

export type {
  ClaimScratchPrizeInput,
  ClaimScratchPrizeResult,
  CustomerView,
  CustomerViewCoupon,
  CustomerViewEntry,
  CustomerViewItem,
  CustomerViewOpenSale,
  CustomerViewPrize,
  CustomerViewScratchWin,
  PlayScratchInput,
  RedeemRewardInput,
  RedeemRewardResult,
  ScratchFormat,
  ScratchPlayResult,
} from './customerView';
export { SCRATCH_FORMATS } from './playScratch';
export type { PinActionField } from './invokeAction';

export interface CustomerPageOperations {
  /** A visão pública do cliente dono do token do link (sem login). */
  getCustomerView(token: string): Promise<CustomerView>;
  /** Troca pontos por um produto-prêmio (token + PIN); vira cupom pendente. */
  redeemReward(input: RedeemRewardInput): Promise<RedeemRewardResult>;
  /** Joga a raspadinha (token + PIN): o servidor debita, sorteia e grava antes de responder. */
  playScratch(input: PlayScratchInput): Promise<ScratchPlayResult>;
  /** Escolhe o produto-prêmio de uma jogada ganha (token + PIN); vira cupom pendente. */
  claimScratchPrize(input: ClaimScratchPrizeInput): Promise<ClaimScratchPrizeResult>;
}

export function createCustomerPageOperations(db: DbClient): CustomerPageOperations {
  return {
    getCustomerView: (token) => getCustomerView(db, token),
    redeemReward: (input) => redeemReward(db, input),
    playScratch: (input) => playScratch(db, input),
    claimScratchPrize: (input) => claimScratchPrize(db, input),
  };
}
