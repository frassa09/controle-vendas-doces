import type { DbClient } from '../db/client';
import type { ClaimScratchPrizeInput, ClaimScratchPrizeResult } from './customerView';
import { checkTokenAndPin, invokePinAction } from './invokeAction';

/**
 * Escolhe o prêmio de uma raspadinha ganha (token + PIN): o produto, entre os
 * marcados como prêmio, vira cupom pendente. Um prêmio por jogada.
 * Erros: LINK_NOT_FOUND, INVALID_INPUT, PIN_INVALID, PIN_LOCKED,
 * SCRATCH_PLAY_NOT_FOUND (jogada perdida, de outro cliente ou inexistente),
 * PRIZE_ALREADY_CLAIMED, PRIZE_NOT_AVAILABLE, NETWORK, UNEXPECTED.
 */
export async function claimScratchPrize(
  db: DbClient,
  input: ClaimScratchPrizeInput,
): Promise<ClaimScratchPrizeResult> {
  const { token, pin } = checkTokenAndPin(input.token, input.pin);
  return invokePinAction<ClaimScratchPrizeResult>(db, 'customer-scratch-prize', {
    token,
    pin,
    playId: input.playId,
    productId: input.productId,
  });
}
