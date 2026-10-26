import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import type { DbClient } from '../db/client';
import { CoreError, type CoreErrorCode } from '../errors';

/** Formato do token do link (gerado pelo banco: 32 bytes em hex). */
export const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const PIN_PATTERN = /^[0-9]{4}$/;

/** Campos de erro das ações com PIN (a página mostra a mensagem abaixo do campo). */
export type PinActionField = 'pin';

/** Corpo de erro das edge functions com PIN (ver supabase/functions/_shared). */
interface ActionErrorBody {
  error?: string;
  attemptsLeft?: number;
  lockedUntil?: string;
}

const knownCodes = new Set<CoreErrorCode>([
  'LINK_NOT_FOUND',
  'PIN_INVALID',
  'PIN_LOCKED',
  'PRIZE_NOT_AVAILABLE',
  'INSUFFICIENT_POINTS',
  'INVALID_INPUT',
]);

/**
 * Confere token e PIN antes de ir ao servidor. Token fora do formato é
 * LINK_NOT_FOUND; PIN fora do formato é INVALID_INPUT (não gasta tentativa).
 */
export function checkTokenAndPin(token: string, pin: string): { token: string; pin: string } {
  const cleanToken = token.trim();
  if (!TOKEN_PATTERN.test(cleanToken)) throw new CoreError('LINK_NOT_FOUND');
  const cleanPin = pin.trim();
  if (!PIN_PATTERN.test(cleanPin)) {
    throw new CoreError<PinActionField>('INVALID_INPUT', {
      fieldErrors: { pin: 'Digite os 4 números do PIN.' },
    });
  }
  return { token: cleanToken, pin: cleanPin };
}

/**
 * Chama uma edge function da página do cliente que exige token + PIN e traduz a
 * resposta de erro num CoreError com mensagem pronta (tentativas restantes,
 * minutos de bloqueio). Reaproveitada pela raspadinha.
 */
export async function invokePinAction<T>(
  db: DbClient,
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const result = await db.functions.invoke<T>(name, { body });
  const error: unknown = result.error;
  if (error) {
    if (error instanceof FunctionsHttpError) throw await fromActionError(error);
    if (error instanceof FunctionsFetchError) throw new CoreError('NETWORK', { cause: error });
    throw new CoreError('UNEXPECTED', { cause: error });
  }
  if (!result.data) throw new CoreError('UNEXPECTED');
  return result.data;
}

async function fromActionError(error: FunctionsHttpError): Promise<CoreError> {
  let body: ActionErrorBody = {};
  try {
    body = (await (error.context as Response).json()) as ActionErrorBody;
  } catch {
    // Sem corpo JSON: cai no erro inesperado abaixo.
  }
  const code = body.error as CoreErrorCode | undefined;
  if (!code || !knownCodes.has(code)) return new CoreError('UNEXPECTED', { cause: error });

  if (code === 'PIN_INVALID') {
    const left = body.attemptsLeft ?? 0;
    const message =
      left === 1
        ? 'PIN errado. Você tem mais 1 tentativa antes de uma pausa.'
        : `PIN errado. Você tem mais ${String(left)} tentativas antes de uma pausa.`;
    return new CoreError<PinActionField>(code, {
      message,
      fieldErrors: { pin: message },
      cause: error,
    });
  }
  if (code === 'PIN_LOCKED') {
    const minutes = minutesUntil(body.lockedUntil);
    const message = `Muitas tentativas com o PIN errado. Tente de novo ${
      minutes <= 1 ? 'daqui a 1 minuto' : `daqui a ${String(minutes)} minutos`
    }.`;
    return new CoreError<PinActionField>(code, {
      message,
      fieldErrors: { pin: message },
      cause: error,
    });
  }
  if (code === 'INVALID_INPUT') {
    return new CoreError<PinActionField>(code, {
      fieldErrors: { pin: 'Digite os 4 números do PIN.' },
      cause: error,
    });
  }
  return new CoreError(code, { cause: error });
}

function minutesUntil(iso: string | undefined): number {
  const until = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(until)) return 15;
  // Arredonda: o relógio do aparelho pode estar alguns segundos fora do servidor.
  return Math.max(1, Math.round((until - Date.now()) / 60_000));
}
