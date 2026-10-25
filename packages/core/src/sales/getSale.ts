import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { memberEmails, toMemberRef } from './members';
import type { MemberRef, PaymentMethod, RecordStatus, Sale } from './sale';
import { saleNotFound } from './sale';

const saleColumns = `
  id, recorded_by, status, created_at,
  customer:customers!sales_customer_fkey (id, name),
  sale_items (position, product_id, product_name, quantity, unit_price_cents, points),
  payments (id, amount_cents, method, status, recorded_by, created_at)
`;

/** Uma venda da loja com itens, pagamentos e quem registrou. Erros: SALE_NOT_FOUND. */
export async function getSale(db: DbClient, id: string): Promise<Sale> {
  await requireUserId(db);
  if (!isUuid(id)) throw saleNotFound();

  // O RLS só mostra vendas, itens e pagamentos da própria loja.
  const [saleResult, members] = await Promise.all([
    db
      .from('sales')
      .select(saleColumns)
      .eq('id', id)
      .order('position', { referencedTable: 'sale_items' })
      .order('created_at', { referencedTable: 'payments' })
      .maybeSingle(),
    memberEmails(db),
  ]);

  const { data, error } = saleResult;
  if (error) throw fromDbError(error);
  if (!data) throw saleNotFound();

  const member = (userId: string): MemberRef => toMemberRef(members, userId);
  const items = data.sale_items.map((item) => ({
    productId: item.product_id,
    productName: item.product_name,
    quantity: item.quantity,
    unitPriceCents: item.unit_price_cents,
    points: item.points,
    totalCents: item.unit_price_cents * item.quantity,
  }));

  return {
    id: data.id,
    customer: data.customer ? { id: data.customer.id, name: data.customer.name } : null,
    items,
    totalCents: items.reduce((sum, item) => sum + item.totalCents, 0),
    status: data.status as RecordStatus,
    recordedBy: member(data.recorded_by),
    createdAt: data.created_at,
    // Só a venda paga na hora tem pagamento ligado a ela (mesmo que cancelado depois).
    paymentType: data.payments.length > 0 ? 'paidNow' : 'fiado',
    payments: data.payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amount_cents,
      method: payment.method as PaymentMethod,
      status: payment.status as RecordStatus,
      recordedBy: member(payment.recorded_by),
      createdAt: payment.created_at,
    })),
  };
}
