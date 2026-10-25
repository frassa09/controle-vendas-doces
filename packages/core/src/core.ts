import { createAuthOperations, type AuthOperations } from './auth';
import type { DbClient } from './db/client';
import { createStoreOperations, type StoreOperations } from './store';

/**
 * A interface de domínio usada pelo app e pela página do cliente. As telas só
 * conversam com o banco por aqui. Cada grupo corresponde a uma área de negócio
 * da spec (loja, catálogo, clientes, vendas...).
 */
export interface Core {
  auth: AuthOperations;
  store: StoreOperations;
}

export interface CoreDependencies {
  /** Cliente criado com createSupabaseClient. */
  supabase: DbClient;
}

export function createCore({ supabase }: CoreDependencies): Core {
  return {
    auth: createAuthOperations(supabase),
    store: createStoreOperations(supabase),
  };
}
