import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll } from 'vitest';
import { createCore, createSupabaseClient, type Core, type DbClient } from '../../src';
import { testEnv } from './env';

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

const admin = createClient(testEnv.url, testEnv.serviceRoleKey, noSession);

const createdUserIds: string[] = [];

afterAll(async () => {
  // Apaga os usuários criados pelo arquivo de teste. As lojas ficam no projeto de
  // testes (cada teste cria a sua, então não há interferência entre testes).
  await Promise.all(createdUserIds.map((id) => admin.auth.admin.deleteUser(id)));
});

export interface TestPerson {
  userId: string;
  email: string;
  password: string;
  /** O core, exatamente como o app o usa. */
  core: Core;
  /**
   * O cliente Supabase autenticado como esta pessoa, sem passar pelo core.
   * Serve só para simular um atacante que usa a chave pública diretamente;
   * comportamento de negócio é sempre verificado pelo core.
   */
  rawClient: DbClient;
}

/** Uma pessoa com conta e já logada pelo core. */
export async function newSignedInPerson(): Promise<TestPerson> {
  const email = `t-${randomUUID()}@test.local`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);
  const rawClient = newClient();
  const core = createCore({ supabase: rawClient });
  await core.auth.signIn({ email, password });
  return { userId: data.user.id, email, password, core, rawClient };
}

/** Um core sem ninguém logado. */
export function anonymousCore(): Core {
  return createCore({ supabase: newClient() });
}

/**
 * Um cliente Supabase sem login, só com a chave pública: o que qualquer pessoa na
 * internet tem. Serve para provar que nada vaza para anon.
 */
export function anonymousClient(): DbClient {
  return newClient();
}

export function trackUserForCleanup(userId: string): void {
  createdUserIds.push(userId);
}

function newClient(): DbClient {
  return createSupabaseClient({ url: testEnv.url, anonKey: testEnv.anonKey });
}

/**
 * Lança no livro de pontos um débito de resgate como se o cliente tivesse gastado
 * os pontos (o resgate ainda não existe no core). Só para montar o cenário de
 * estorno com saldo já gasto; usa a chave de serviço.
 */
export async function simulatePointsSpent(
  storeId: string,
  customerId: string,
  points: number,
): Promise<void> {
  const { error } = await admin.from('points_ledger').insert({
    store_id: storeId,
    customer_id: customerId,
    kind: 'redemption',
    points: -points,
  });
  if (error) throw error;
}
