import { CoreError, type CoreErrorCode } from '../errors';

/** Formato comum dos erros devolvidos pelo PostgREST (consultas e RPC). */
interface PostgrestLikeError {
  code?: string;
  message: string;
}

/** Códigos de negócio que as funções SQL levantam com errcode P0001. */
const businessCodes = new Set<CoreErrorCode>([
  'NOT_AUTHENTICATED',
  'ALREADY_HAS_STORE',
  'INVITE_NOT_FOUND',
  'INVITE_ALREADY_USED',
]);

/**
 * Traduz um erro do banco num CoreError. As funções SQL levantam
 * `raise exception using errcode = 'P0001', message = '<CÓDIGO>'`.
 */
export function fromDbError(error: PostgrestLikeError): CoreError {
  if (error.code === 'P0001' && businessCodes.has(error.message as CoreErrorCode)) {
    return new CoreError(error.message as CoreErrorCode, { cause: error });
  }
  if (error.code === '23514' || error.code === '23502') {
    return new CoreError('INVALID_INPUT', { cause: error });
  }
  // Token expirado ou inválido.
  if (error.code === 'PGRST301' || error.code === 'PGRST303') {
    return new CoreError('NOT_AUTHENTICATED', { cause: error });
  }
  // Sem grant ou barrado pelo RLS.
  if (error.code === '42501') {
    return new CoreError('FORBIDDEN', { cause: error });
  }
  if (isNetworkFailure(error)) {
    return new CoreError('NETWORK', { cause: error });
  }
  return new CoreError('UNEXPECTED', { cause: error });
}

function isNetworkFailure(error: PostgrestLikeError): boolean {
  return /fetch failed|network request failed|failed to fetch/i.test(error.message);
}
