import type { DbClient } from '../db/client';
import type { CustomerView, RedeemRewardInput, RedeemRewardResult } from './customerView';
import { getCustomerView } from './getCustomerView';
import { redeemReward } from './redeemReward';

export type {
  CustomerView,
  CustomerViewCoupon,
  CustomerViewEntry,
  CustomerViewItem,
  CustomerViewOpenSale,
  CustomerViewPrize,
  RedeemRewardInput,
  RedeemRewardResult,
} from './customerView';
export type { PinActionField } from './invokeAction';

export interface CustomerPageOperations {
  /** A visão pública do cliente dono do token do link (sem login). */
  getCustomerView(token: string): Promise<CustomerView>;
  /** Troca pontos por um produto-prêmio (token + PIN); vira cupom pendente. */
  redeemReward(input: RedeemRewardInput): Promise<RedeemRewardResult>;
}

export function createCustomerPageOperations(db: DbClient): CustomerPageOperations {
  return {
    getCustomerView: (token) => getCustomerView(db, token),
    redeemReward: (input) => redeemReward(db, input),
  };
}
