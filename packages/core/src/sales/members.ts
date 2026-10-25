import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import type { MemberRef } from './sale';

/** E-mail de cada membro da loja, por id de usuário. */
export async function memberEmails(db: DbClient): Promise<Map<string, string>> {
  const { data, error } = await db.rpc('list_store_members');
  if (error) throw fromDbError(error);
  return new Map(data.map((row) => [row.user_id, row.email]));
}

/** O MemberRef de um usuário, a partir dos e-mails lidos por memberEmails. */
export function toMemberRef(emails: Map<string, string>, userId: string): MemberRef {
  return { id: userId, email: emails.get(userId) ?? null };
}
