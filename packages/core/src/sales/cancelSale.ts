import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { getSale } from './getSale';
import { saleNotFound, type Sale } from './sale';

/**
 * Cancela uma venda registrada por engano. Ela continua no histórico como
 * cancelada, sai do saldo devedor e leva junto o pagamento feito na hora; os
 * pontos que ela tinha dado são estornados (o saldo de pontos pode ficar negativo).
 * Erros: NOT_AUTHENTICATED, SALE_NOT_FOUND, SALE_CANCELLED, PAYMENTS_EXCEED_DEBT
 * (um pagamento de dívida já cobre esta venda: cancele-o antes).
 */
export async function cancelSale(db: DbClient, id: string): Promise<Sale> {
  await requireUserId(db);
  if (!isUuid(id)) throw saleNotFound();

  const { error } = await db.rpc('cancel_sale', { p_sale_id: id });
  if (error) throw fromDbError(error);
  return getSale(db, id);
}
