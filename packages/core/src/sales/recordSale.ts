import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { getSale } from './getSale';
import type { Sale } from './sale';
import { validateSale, type RecordSaleInput } from './saleInput';

/**
 * Registra uma venda: grava a venda e os itens (com cópia do nome, do preço
 * cobrado e dos pontos do produto) numa só operação, em nome de quem está logado.
 * Paga na hora, grava junto um pagamento de mesmo valor; fiado, nenhum (a venda
 * entra no saldo devedor do cliente).
 * Erros: INVALID_INPUT, NOT_AUTHENTICATED, FORBIDDEN (sem loja), CUSTOMER_NOT_FOUND,
 * PRODUCT_NOT_FOUND, PRODUCT_INACTIVE.
 */
export async function recordSale(db: DbClient, input: RecordSaleInput): Promise<Sale> {
  validateSale(input);
  await requireUserId(db);
  if (input.customerId !== null && !isUuid(input.customerId)) {
    throw new CoreError('CUSTOMER_NOT_FOUND');
  }
  if (input.items.some((item) => !isUuid(item.productId))) {
    throw new CoreError('PRODUCT_NOT_FOUND');
  }

  const { data: saleId, error } = await db.rpc('record_sale', {
    // Os tipos gerados não marcam o parâmetro como anulável; null = venda avulsa.
    p_customer_id: input.customerId as unknown as string,
    p_items: input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents ?? null,
    })),
    // null = fiado (sem pagamento).
    p_payment_method: (input.payment.type === 'paidNow'
      ? input.payment.method
      : null) as unknown as string,
  });

  if (error) throw fromDbError(error);
  return getSale(db, saleId);
}
