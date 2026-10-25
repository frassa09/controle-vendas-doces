import { createCore, createSupabaseClient, type Core } from '@cvd/core';

let core: Core | undefined;

/**
 * O core da página do cliente. A página não tem login: a sessão não é guardada.
 * Lê VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (chave pública).
 */
export function getCore(): Core {
  if (!core) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README).');
    }
    core = createCore({ supabase: createSupabaseClient({ url, anonKey }) });
  }
  return core;
}
