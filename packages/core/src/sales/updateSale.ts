import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { getSale } from './getSale';
import { saleNotFound, type Sale } from './sale';
import { validateSaleItems, type UpdateSaleInput } from './saleInput';

/**
 * Corrige os itens de uma venda (quantidades, preços, itens a mais ou a menos). Se
 * a venda foi paga na hora, o pagamento passa a ser do novo total (o antigo fica
 * cancelado no histórico). Os pontos são acertados: a venda que continua quitada
 * recebe a diferença; a que volta a ficar em aberto tem os pontos estornados.
 * Erros: INVALID_INPUT, NOT_AUTHENTICATED, SALE_NOT_FOUND, SALE_CANCELLED,
 * PRODUCT_NOT_FOUND, PRODUCT_INACTIVE (produto novo desativado),
 * PAYMENTS_EXCEED_DEBT (o total cairia abaixo do que pagamentos de dívida já cobriram).
 */
export async function updateSale(db: DbClient, id: string, input: UpdateSaleInput): Promise<Sale> {
  validateSaleItems(input.items);
  await requireUserId(db);
  if (!isUuid(id)) throw saleNotFound();
  if (input.items.some((item) => !isUuid(item.productId))) {
    throw new CoreError('PRODUCT_NOT_FOUND');
  }

  const { error } = await db.rpc('update_sale', {
    p_sale_id: id,
    p_items: input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents ?? null,
    })),
  });
  if (error) throw fromDbError(error);
  return getSale(db, id);
}
