import { CoreError } from '../errors';

/** Quantidade de letras e números de um código de convite (sem o hífen). */
export const INVITE_CODE_LENGTH = 8;

/** O único campo do formulário de entrar com convite. */
export type InviteCodeField = 'code';

/**
 * Normaliza o código digitado: aceita minúsculas, espaços e o hífen do meio.
 * Lança INVALID_INPUT quando não sobra nada.
 */
export function normalizeInviteCode(input: string): string {
  const code = input.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (code === '') {
    throw new CoreError<InviteCodeField>('INVALID_INPUT', {
      fieldErrors: { code: 'Digite o código do convite.' },
    });
  }
  return code;
}
