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
 * Garante que quem está logado é membro de uma loja e devolve o id dela, para as
 * operações que gravam dados da loja. Quem ainda não tem loja recebe FORBIDDEN.
 */
export async function requireStoreId(db: DbClient): Promise<string> {
  await requireUserId(db);
  // O RLS só mostra a loja da qual o usuário é membro (no máximo uma).
  const { data, error } = await db.from('stores').select('id').maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new CoreError('FORBIDDEN', { message: 'Crie ou entre numa loja primeiro.' });
  return data.id;
}
