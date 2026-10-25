import { CoreError } from '../errors';
import { fromDbError } from './errors';
import type { DbClient } from './client';

/**
 * Garante que há alguém logado antes de uma operação de membro e devolve o id do
 * usuário. Lê a sessão guardada (não vai à rede); o banco confere o token de novo.
 */
export async function requireUserId(db: DbClient): Promise<string> {
  const { data } = await db.auth.getSession();
  if (!data.session) throw new CoreError('NOT_AUTHENTICATED');
  return data.session.user.id;
}

/**
 * A loja de quem está logado, para gravar o store_id de um registro novo.
 * Lança NOT_AUTHENTICATED sem sessão e FORBIDDEN se a pessoa não tem loja.
 */
export async function requireStoreId(db: DbClient): Promise<string> {
  const userId = await requireUserId(db);
  const { data, error } = await db
    .from('store_members')
    .select('store_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new CoreError('FORBIDDEN');
  return data.store_id;
}
