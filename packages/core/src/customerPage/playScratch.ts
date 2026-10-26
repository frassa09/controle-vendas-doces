import type { DbClient } from '../db/client';
import { CoreError } from '../errors';
import type { PlayScratchInput, ScratchFormat, ScratchPlayResult } from './customerView';
import { checkTokenAndPin, invokePinAction } from './invokeAction';

/** Os dois jeitos de raspar, na ordem em que a página os oferece. */
export const SCRATCH_FORMATS: readonly ScratchFormat[] = ['five_spots', 'match_three'];

/**
 * Joga a raspadinha pela página do cliente (sem login): token + PIN + formato. O
 * servidor vence os pontos, confere o saldo, debita o custo da loja, sorteia com a
 * chance da loja (a mesma nos dois formatos) e grava a jogada numa transação antes
 * de responder; a página só encena o resultado. Erros: LINK_NOT_FOUND,
 * INVALID_INPUT (PIN ou formato), PIN_INVALID, PIN_LOCKED, NO_PRIZES_AVAILABLE,
 * INSUFFICIENT_POINTS, NETWORK, UNEXPECTED.
 */
export async function playScratch(
  db: DbClient,
  input: PlayScratchInput,
): Promise<ScratchPlayResult> {
  if (!SCRATCH_FORMATS.includes(input.format)) {
    throw new CoreError<'format'>('INVALID_INPUT', {
      fieldErrors: { format: 'Escolha um jeito de raspar.' },
    });
  }
  const { token, pin } = checkTokenAndPin(input.token, input.pin);
  try {
    return await invokePinAction<ScratchPlayResult>(db, 'customer-scratch', {
      token,
      pin,
      format: input.format,
    });
  } catch (error) {
    if (error instanceof CoreError && error.code === 'INSUFFICIENT_POINTS') {
      throw new CoreError('INSUFFICIENT_POINTS', {
        message: 'Ainda não há pontos suficientes para raspar.',
        cause: error,
      });
    }
    throw error;
  }
}
