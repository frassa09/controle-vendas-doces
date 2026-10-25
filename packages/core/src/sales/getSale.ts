import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { memberEmails, toMemberRef } from './members';
import type { MemberRef, PaymentMethod, RecordStatus, Sale, SaleItem, SaleVersion } from './sale';
import { saleNotFound } from './sale';

const saleColumns = `
  id, recorded_by, status, created_at, edited_at, edited_by, cancelled_at, cancelled_by,
  customer:customers!sales_customer_fkey (id, name),
  sale_items (position, product_id, product_name, quantity, unit_price_cents, points),
  payments (id, amount_cents, method, status, recorded_by, created_at, cancelled_at, cancelled_by),
  sale_item_revisions (
    revision, replaced_at, replaced_by, position, product_id, product_name, quantity,
    unit_price_cents, points
  )
`;

interface ItemRow {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  points: number;
}

const toItem = (item: ItemRow): SaleItem => ({
  productId: item.product_id,
  productName: item.product_name,
  quantity: item.quantity,
  unitPriceCents: item.unit_price_cents,
  points: item.points,
  totalCents: item.unit_price_cents * item.quantity,
});

const sumTotal = (items: SaleItem[]) => items.reduce((sum, item) => sum + item.totalCents, 0);

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
      .order('revision', { referencedTable: 'sale_item_revisions', ascending: false })
      .order('position', { referencedTable: 'sale_item_revisions' })
      .maybeSingle(),
    memberEmails(db),
  ]);

  const { data, error } = saleResult;
  if (error) throw fromDbError(error);
  if (!data) throw saleNotFound();

  const member = (userId: string): MemberRef => toMemberRef(members, userId);
  const items = data.sale_items.map(toItem);

  // Linhas de todas as versões, já em ordem (versão mais recente primeiro, por posição).
  const previousVersions: SaleVersion[] = [];
  for (const row of data.sale_item_revisions) {
    let version = previousVersions.at(-1);
    if (version?.revision !== row.revision) {
      version = {
        revision: row.revision,
        replacedAt: row.replaced_at,
        replacedBy: member(row.replaced_by),
        items: [],
        totalCents: 0,
      };
      previousVersions.push(version);
    }
    version.items.push(toItem(row));
  }
  for (const version of previousVersions) version.totalCents = sumTotal(version.items);

  return {
    id: data.id,
    customer: data.customer ? { id: data.customer.id, name: data.customer.name } : null,
    items,
    totalCents: sumTotal(items),
    status: data.status as RecordStatus,
    recordedBy: member(data.recorded_by),
    createdAt: data.created_at,
    editedAt: data.edited_at,
    editedBy: data.edited_by === null ? null : member(data.edited_by),
    cancelledAt: data.cancelled_at,
    cancelledBy: data.cancelled_by === null ? null : member(data.cancelled_by),
    // Só a venda paga na hora tem pagamento ligado a ela (mesmo que cancelado depois).
    paymentType: data.payments.length > 0 ? 'paidNow' : 'fiado',
    payments: data.payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amount_cents,
      method: payment.method as PaymentMethod,
      status: payment.status as RecordStatus,
      recordedBy: member(payment.recorded_by),
      createdAt: payment.created_at,
      cancelledAt: payment.cancelled_at,
      cancelledBy: payment.cancelled_by === null ? null : member(payment.cancelled_by),
    })),
    previousVersions,
  };
}
