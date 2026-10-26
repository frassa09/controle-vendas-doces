import { CoreError, type FieldErrors } from '../errors';

/** Regras de fidelidade da loja que o app configura. */
export interface RewardSettingsInput {
  /** Pontos de um resgate direto (produto grátis). */
  redeemCost: number;
}

export type RewardSettingsField = keyof RewardSettingsInput;

/** Limites espelhados nas constraints de public.stores. */
export const REWARD_LIMITS = {
  redeemCost: { min: 1, max: 1000, default: 10 },
} as const;

export function validateRewardSettings(input: RewardSettingsInput): RewardSettingsInput {
  const fieldErrors: FieldErrors<RewardSettingsField> = {};
  const { min, max } = REWARD_LIMITS.redeemCost;
  if (!Number.isInteger(input.redeemCost) || input.redeemCost < min || input.redeemCost > max) {
    fieldErrors.redeemCost = `Use um número inteiro de ${String(min)} a ${String(max)} pontos.`;
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new CoreError<RewardSettingsField>('INVALID_INPUT', { fieldErrors });
  }
  return { redeemCost: input.redeemCost };
}
