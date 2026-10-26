import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireStoreId } from '../db/session';
import { CoreError } from '../errors';
import { validateRewardSettings, type RewardSettingsInput } from './rewardSettings';
import { storeColumns, toStore, type Store } from './store';

/**
 * Altera as regras de fidelidade da loja (custo do resgate direto, custo e chance
 * da raspadinha); só os campos informados mudam. Qualquer membro pode.
 * Erros: INVALID_INPUT (campos, ou nenhum campo), NOT_AUTHENTICATED, FORBIDDEN.
 */
export async function updateRewardSettings(
  db: DbClient,
  input: RewardSettingsInput,
): Promise<Store> {
  const settings = validateRewardSettings(input);
  const update = {
    ...(settings.redeemCost === undefined ? {} : { redeem_cost: settings.redeemCost }),
    ...(settings.scratchCost === undefined ? {} : { scratch_cost: settings.scratchCost }),
    ...(settings.scratchWinPercent === undefined
      ? {}
      : { scratch_win_percent: settings.scratchWinPercent }),
  };
  if (Object.keys(update).length === 0) throw new CoreError('INVALID_INPUT');
  const storeId = await requireStoreId(db);

  const { data, error } = await db
    .from('stores')
    .update(update)
    .eq('id', storeId)
    .select(storeColumns)
    .single();
  if (error) throw fromDbError(error);
  return toStore(data);
}
