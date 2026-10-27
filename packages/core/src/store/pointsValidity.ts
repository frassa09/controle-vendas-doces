import { CoreError, type FieldErrors } from '../errors';

/** Limites espelhados na constraint stores_points_validity_valid. */
export const POINTS_VALIDITY_LIMITS = { minDays: 1, maxDays: 3650 } as const;

/** Confere a validade em dias (inteiro de 1 a 3650) ou null (sem validade). */
export function validatePointsValidity(days: number | null): number | null {
  if (days === null) return null;
  if (
    !Number.isInteger(days) ||
    days < POINTS_VALIDITY_LIMITS.minDays ||
    days > POINTS_VALIDITY_LIMITS.maxDays
  ) {
    const fieldErrors: FieldErrors<'pointsValidityDays'> = {
      pointsValidityDays: `Use de ${String(POINTS_VALIDITY_LIMITS.minDays)} a ${String(POINTS_VALIDITY_LIMITS.maxDays)} dias.`,
    };
    throw new CoreError<'pointsValidityDays'>('INVALID_INPUT', { fieldErrors });
  }
  return days;
}
