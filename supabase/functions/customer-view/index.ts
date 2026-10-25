// Página do cliente: devolve a visão pública do cliente dono do token do link.
//
// Sem login (verify_jwt = false em supabase/config.toml): quem autoriza é o token
// secreto. A leitura é feita por public.get_customer_page, executável só pela
// service role; a chave pública (anon) não lê nenhuma tabela.
//
// POST { token } -> 200 { view } | 404 { error: 'LINK_NOT_FOUND' }
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  let token: unknown;
  try {
    ({ token } = (await req.json()) as { token?: unknown });
  } catch {
    return json({ error: 'LINK_NOT_FOUND' }, 404);
  }
  // O formato do token (64 hex) é conferido antes de ir ao banco.
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
    return json({ error: 'LINK_NOT_FOUND' }, 404);
  }

  const { data, error } = await admin.rpc('get_customer_page', { p_token: token });
  if (error) {
    console.error('get_customer_page', error.code, error.message);
    return json({ error: 'UNEXPECTED' }, 500);
  }
  if (data === null) return json({ error: 'LINK_NOT_FOUND' }, 404);
  return json({ view: data }, 200);
});
