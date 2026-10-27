import type { DbClient } from '../db/client';
import type { RedeemRewardInput, RedeemRewardResult } from './customerView';
import { checkTokenAndPin, invokePinAction } from './invokeAction';

/**
 * Troca pontos por um produto-prêmio pela página do cliente (sem login): token +
 * PIN. O servidor debita o custo do resgate da loja e cria o cupom pendente numa
 * transação. Erros: LINK_NOT_FOUND, INVALID_INPUT (PIN fora do formato),
 * PIN_INVALID (com as tentativas restantes), PIN_LOCKED (bloqueio temporário),
 * PRIZE_NOT_AVAILABLE, INSUFFICIENT_POINTS, NETWORK, UNEXPECTED.
 */
export async function redeemReward(
  db: DbClient,
  input: RedeemRewardInput,
): Promise<RedeemRewardResult> {
  const { token, pin } = checkTokenAndPin(input.token, input.pin);
  return invokePinAction<RedeemRewardResult>(db, 'customer-redeem', {
    token,
    pin,
    productId: input.productId,
  });
}
