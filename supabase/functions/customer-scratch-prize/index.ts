// Prêmio da raspadinha: o cliente escolhe o produto de uma jogada ganha e ele vira cupom.
//
// Sem login (verify_jwt = false em supabase/config.toml): token do link + PIN. O
// cupom é criado por public.claim_scratch_prize (executável só pela service role),
// uma vez por jogada ganha.
//
// POST { token, pin, playId, productId }
//   200 { coupon: { id, productName, origin, createdAt } }
//   400 INVALID_INPUT · 403 PIN_INVALID { attemptsLeft } · 404 LINK_NOT_FOUND
//   404 SCRATCH_PLAY_NOT_FOUND · 409 PRIZE_ALREADY_CLAIMED · 409 PRIZE_NOT_AVAILABLE
//   429 PIN_LOCKED { lockedUntil }
import { admin, isUuid, serveCustomerAction } from '../_shared/customerAction.ts';

// Ids que não são uuid chegam nulos ao banco, que só responde depois de conferir o PIN.
serveCustomerAction('claim_scratch_prize', ({ token, pin, body }) =>
  admin.rpc('claim_scratch_prize', {
    p_token: token,
    p_pin: pin,
    p_play_id: isUuid(body.playId) ? body.playId : null,
    p_product_id: isUuid(body.productId) ? body.productId : null,
  }),
);
