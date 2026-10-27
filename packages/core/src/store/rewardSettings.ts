import { CoreError, type FieldErrors } from '../errors';

/** Regras de fidelidade da loja que o app configura. Campo ausente fica como está. */
export interface RewardSettingsInput {
  /** Pontos de um resgate direto (produto grátis). */
  redeemCost?: number;
  /** Pontos de uma jogada da raspadinha. */
  scratchCost?: number;
  /** Chance de prêmio por jogada da raspadinha, em % inteiro (0 a 100). */
  scratchWinPercent?: number;
}

export type RewardSettingsField = keyof RewardSettingsInput;

/** Limites espelhados nas constraints de public.stores. */
export const REWARD_LIMITS = {
  redeemCost: { min: 1, max: 1000, default: 10 },
  scratchCost: { min: 1, max: 1000, default: 5 },
  scratchWinPercent: { min: 0, max: 100, default: 10 },
} as const;

function outside(value: number, limits: { min: number; max: number }): boolean {
  return !Number.isInteger(value) || value < limits.min || value > limits.max;
}

export function validateRewardSettings(input: RewardSettingsInput): RewardSettingsInput {
  const fieldErrors: FieldErrors<RewardSettingsField> = {};
  const settings: RewardSettingsInput = {};
  for (const field of ['redeemCost', 'scratchCost'] as const) {
    const value = input[field];
    if (value === undefined) continue;
    const limits = REWARD_LIMITS[field];
    if (outside(value, limits)) {
      fieldErrors[field] =
        `Use um número inteiro de ${String(limits.min)} a ${String(limits.max)} pontos.`;
    } else {
      settings[field] = value;
    }
  }
  const chance = input.scratchWinPercent;
  if (chance !== undefined) {
    const limits = REWARD_LIMITS.scratchWinPercent;
    if (outside(chance, limits)) {
      fieldErrors.scratchWinPercent = `Use uma chance inteira de ${String(limits.min)} a ${String(limits.max)}%.`;
    } else {
      settings.scratchWinPercent = chance;
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new CoreError<RewardSettingsField>('INVALID_INPUT', { fieldErrors });
  }
  return settings;
}
