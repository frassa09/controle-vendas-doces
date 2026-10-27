// Raspadinha pela página do cliente: gasta pontos numa jogada sorteada aqui no servidor.
//
// Sem login (verify_jwt = false em supabase/config.toml): autoriza o token do link
// + o PIN do cliente. public.play_scratch (executável só pela service role) confere
// PIN e saldo, debita, sorteia com a chance da loja e grava a jogada numa transação;
// só depois disso a resposta sai. A página apenas encena o resultado já gravado.
//
// POST { token, pin, format: 'five_spots' | 'match_three' }
//   200 { play: { id, format, won, createdAt }, balance }
//   400 INVALID_INPUT · 403 PIN_INVALID { attemptsLeft } · 404 LINK_NOT_FOUND
//   409 NO_PRIZES_AVAILABLE · 409 INSUFFICIENT_POINTS { balance, cost }
//   429 PIN_LOCKED { lockedUntil }
import { admin, serveCustomerAction } from '../_shared/customerAction.ts';

serveCustomerAction('play_scratch', ({ token, pin, body }) =>
  admin.rpc('play_scratch', {
    p_token: token,
    p_pin: pin,
    // Formato desconhecido vira INVALID_INPUT no banco (antes do PIN).
    p_format: typeof body.format === 'string' ? body.format : null,
  }),
);
