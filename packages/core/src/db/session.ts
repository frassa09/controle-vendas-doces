import { CoreError } from '../errors';
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
