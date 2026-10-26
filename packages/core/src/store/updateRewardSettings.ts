import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireStoreId } from '../db/session';
import { validateRewardSettings, type RewardSettingsInput } from './rewardSettings';
import { storeColumns, toStore, type Store } from './store';

/**
 * Altera as regras de fidelidade da loja (custo do resgate direto). Qualquer
 * membro pode. Erros: INVALID_INPUT (campos), NOT_AUTHENTICATED, FORBIDDEN.
 */
export async function updateRewardSettings(
  db: DbClient,
  input: RewardSettingsInput,
): Promise<Store> {
  const settings = validateRewardSettings(input);
  const storeId = await requireStoreId(db);

  const { data, error } = await db
    .from('stores')
    .update({ redeem_cost: settings.redeemCost })
    .eq('id', storeId)
    .select(storeColumns)
    .single();
  if (error) throw fromDbError(error);
  return toStore(data);
}
