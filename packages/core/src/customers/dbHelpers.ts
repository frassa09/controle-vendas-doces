import { fromDbError } from '../db/errors';
import { CoreError } from '../errors';

export interface PostgrestLikeError {
  code?: string;
  message: string;
}

/** Id que não é um uuid válido também é "cliente não encontrado". */
export function fromCustomerDbError(error: PostgrestLikeError): CoreError {
  if (error.code === '22P02') return new CoreError('CUSTOMER_NOT_FOUND', { cause: error });
  return fromDbError(error);
}
