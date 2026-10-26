// Resgate direto pela página do cliente: troca pontos por um produto-prêmio.
//
// Sem login (verify_jwt = false em supabase/config.toml): autoriza o token do link
// + o PIN do cliente. Débito e cupom numa transação em public.redeem_reward
// (executável só pela service role), que também conta as tentativas de PIN.
//
// POST { token, pin, productId }
//   200 { coupon: { id, productName, origin, createdAt }, balance }
//   400 INVALID_INPUT · 403 PIN_INVALID { attemptsLeft } · 404 LINK_NOT_FOUND
//   409 PRIZE_NOT_AVAILABLE · 409 INSUFFICIENT_POINTS { balance, cost }
//   429 PIN_LOCKED { lockedUntil }
import { admin, isUuid, serveCustomerAction } from '../_shared/customerAction.ts';

// Id que não é uuid não é produto-prêmio, mas o PIN ainda é conferido antes (o
// banco recebe null e responde PRIZE_NOT_AVAILABLE só depois do PIN certo).
serveCustomerAction('redeem_reward', ({ token, pin, body }) =>
  admin.rpc('redeem_reward', {
    p_token: token,
    p_pin: pin,
    p_product_id: isUuid(body.productId) ? body.productId : null,
  }),
);
