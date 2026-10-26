// Base das ações da página do cliente que exigem token + PIN (resgate direto,
// raspadinha). Cada ação chama uma função SQL executável só pela service role,
// que devolve jsonb { error: '<CÓDIGO>', ... } ou o resultado. Este módulo valida
// o formato da entrada antes de ir ao banco e traduz o código no status HTTP.
//
// Respostas de erro: { error, attemptsLeft? , lockedUntil?, balance?, cost? }.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const TOKEN = /^[0-9a-f]{64}$/;
const PIN = /^[0-9]{4}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Status HTTP de cada código de erro de negócio. */
const statusOf: Record<string, number> = {
  INVALID_INPUT: 400,
  PIN_INVALID: 403,
  LINK_NOT_FOUND: 404,
  PRIZE_NOT_AVAILABLE: 409,
  INSUFFICIENT_POINTS: 409,
  PIN_LOCKED: 429,
};

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** Corpo comum das ações com PIN, já conferido. */
export interface PinRequest {
  token: string;
  pin: string;
  body: Record<string, unknown>;
}

/**
 * Serve uma ação com token + PIN. `run` recebe a entrada conferida e devolve o
 * jsonb da função SQL. PIN fora do formato não chega ao banco (nem conta tentativa).
 */
export function serveCustomerAction(
  name: string,
  run: (
    request: PinRequest,
  ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>,
): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await req.json();
      if (typeof parsed !== 'object' || parsed === null) throw new Error('corpo');
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: 'INVALID_INPUT' }, 400);
    }
    const { token, pin } = body;
    if (typeof token !== 'string' || !TOKEN.test(token)) {
      return json({ error: 'LINK_NOT_FOUND' }, 404);
    }
    if (typeof pin !== 'string' || !PIN.test(pin)) return json({ error: 'INVALID_INPUT' }, 400);

    const { data, error } = await run({ token, pin, body });
    if (error) {
      console.error(name, error.code, error.message);
      return json({ error: 'UNEXPECTED' }, 500);
    }
    const result = (data ?? {}) as Record<string, unknown>;
    const code = typeof result.error === 'string' ? result.error : null;
    if (code) return json(result, statusOf[code] ?? 400);
    return json(result, 200);
  });
}
