import type { Database } from '../db/database.types';

/** Um código de convite da loja, como as telas o enxergam. */
export interface StoreInvite {
  /** O código para mostrar e compartilhar, no formato `ABCD-EFGH`. */
  code: string;
  createdAt: string;
}

export type StoreInviteRow = Database['public']['Tables']['store_invites']['Row'];

/** Colunas lidas sempre que o core devolve um convite. */
export const inviteColumns = 'code, created_at';

export function toStoreInvite(row: Pick<StoreInviteRow, 'code' | 'created_at'>): StoreInvite {
  return { code: formatInviteCode(row.code), createdAt: row.created_at };
}

/** Separa o código em dois grupos de quatro, mais fácil de ler e ditar. */
function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
