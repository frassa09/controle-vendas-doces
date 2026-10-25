import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './database.types';

/** Cliente Supabase tipado com o schema gerado das migrações. Uso interno do core. */
export type DbClient = SupabaseClient<Database>;

export interface SupabaseConnection {
  url: string;
  /** Chave pública (anon/publishable). Nunca a service role. */
  anonKey: string;
  /**
   * Onde guardar a sessão. No app, o AsyncStorage; sem storage a sessão vive só
   * na memória (testes, página pública).
   */
  storage?: SupportedStorage;
}

/**
 * Cria o cliente Supabase que deve ser passado a createCore. Fica no core para que
 * app e web não dependam do supabase-js diretamente.
 */
export function createSupabaseClient({ url, anonKey, storage }: SupabaseConnection): DbClient {
  return createClient<Database>(url, anonKey, {
    auth: storage
      ? { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      : { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
