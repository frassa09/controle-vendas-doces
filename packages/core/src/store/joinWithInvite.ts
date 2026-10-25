import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { normalizeInviteCode } from './inviteCode';
import { toStore, type Store } from './store';

/**
 * Entra na loja do código de convite: quem está logado vira membro, com as mesmas
 * permissões de quem já está lá. Aceita minúsculas, espaços e o hífen.
 * Erros: INVALID_INPUT (código vazio), NOT_AUTHENTICATED, ALREADY_HAS_STORE,
 * INVITE_NOT_FOUND, INVITE_ALREADY_USED.
 */
export async function joinWithInvite(db: DbClient, input: string): Promise<Store> {
  const code = normalizeInviteCode(input);
  await requireUserId(db);

  const { data, error } = await db.rpc('join_store_with_invite', { p_code: code });

  if (error) {
    if (error.code === '23505') throw new CoreError('ALREADY_HAS_STORE', { cause: error });
    throw fromDbError(error);
  }
  return toStore(data);
}
