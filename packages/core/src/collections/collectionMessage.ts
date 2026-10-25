import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { formatCents } from '../money';
import { getCustomerBalance } from '../payments/getCustomerBalance';
import type { SaleStanding } from '../payments/payment';
import { toCollectionTemplate } from './collectionTemplate';
import { buildPixCopyAndPaste } from './pix';
import { renderCollectionTemplate } from './template';

/** A mensagem de cobrança pronta e o link que a abre no WhatsApp do cliente. */
export interface CollectionMessage {
  customerId: string;
  customerName: string;
  /** Quanto o cliente deve agora, em centavos. */
  balanceCents: number;
  /** O Pix copia-e-cola com o valor do saldo. */
  pixCode: string;
  text: string;
  /** https://wa.me/<número>?text=<mensagem> */
  whatsappUrl: string;
}

export interface CollectionMessageSettings {
  /** Endereço da página do cliente (ex.: https://cantinho.vercel.app); sem ele, {link} fica vazio. */
  customerPageUrl?: string | undefined;
}

/** Identificador do Pix das cobranças (alfanumérico: `***` viraria negrito no WhatsApp). */
const PIX_TXID = 'COBRANCA';

/** Link do WhatsApp com a mensagem pronta (`wa.me`, texto codificado uma vez só). */
export function buildWhatsAppUrl(whatsapp: string, text: string): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
}

/** dd/mm no horário de Brasília (UTC-3, sem horário de verão desde 2019). */
function dayMonth(iso: string): string {
  const date = new Date(Date.parse(iso) - 3 * 60 * 60 * 1000);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function itemsLine(sale: SaleStanding, items: { name: string; quantity: number }[]): string {
  const what = items.map((item) => `${String(item.quantity)}x ${item.name}`).join(', ');
  const amount =
    sale.status === 'partial'
      ? `${formatCents(sale.remainingCents)} (falta de ${formatCents(sale.totalCents)})`
      : formatCents(sale.remainingCents);
  return `• ${dayMonth(sale.createdAt)} – ${what} – ${amount}`;
}

/**
 * Monta a mensagem de cobrança do cliente: as vendas em aberto (pela alocação FIFO,
 * a parte já paga não entra), o total, o Pix com o valor e o link da página.
 * Erros: NOT_AUTHENTICATED, FORBIDDEN, CUSTOMER_NOT_FOUND, NO_DEBT.
 */
export async function buildCollectionMessage(
  db: DbClient,
  customerId: string,
  settings: CollectionMessageSettings,
): Promise<CollectionMessage> {
  await requireUserId(db);
  if (!isUuid(customerId)) throw new CoreError('CUSTOMER_NOT_FOUND');

  const [storeResult, customerResult, balance] = await Promise.all([
    db.from('stores').select('name, pix_key, city, collection_template').maybeSingle(),
    db.from('customers').select('name, whatsapp, link_token').eq('id', customerId).maybeSingle(),
    getCustomerBalance(db, customerId),
  ]);
  if (storeResult.error) throw fromDbError(storeResult.error);
  if (customerResult.error) throw fromDbError(customerResult.error);
  if (!storeResult.data) throw new CoreError('FORBIDDEN');
  if (!customerResult.data) throw new CoreError('CUSTOMER_NOT_FOUND');
  if (balance.balanceCents <= 0) throw new CoreError('NO_DEBT');

  const store = storeResult.data;
  const customer = customerResult.data;
  const open = balance.sales.filter((sale) => sale.remainingCents > 0);

  const itemsResult = await db
    .from('sale_items')
    .select('sale_id, product_name, quantity')
    .in(
      'sale_id',
      open.map((sale) => sale.saleId),
    )
    .order('position');
  if (itemsResult.error) throw fromDbError(itemsResult.error);

  const pixCode = buildPixCopyAndPaste({
    key: store.pix_key,
    name: store.name,
    city: store.city,
    amountCents: balance.balanceCents,
    txid: PIX_TXID,
  });

  const base = settings.customerPageUrl?.replace(/\/+$/, '') ?? '';
  const text = renderCollectionTemplate(toCollectionTemplate(store.collection_template).template, {
    nome: customer.name,
    itens: open
      .map((sale) =>
        itemsLine(
          sale,
          itemsResult.data
            .filter((item) => item.sale_id === sale.saleId)
            .map((item) => ({ name: item.product_name, quantity: item.quantity })),
        ),
      )
      .join('\n'),
    total: formatCents(balance.balanceCents),
    pix: pixCode,
    link: base === '' ? '' : `${base}/c/${customer.link_token}`,
  });

  return {
    customerId,
    customerName: customer.name,
    balanceCents: balance.balanceCents,
    pixCode,
    text,
    whatsappUrl: buildWhatsAppUrl(customer.whatsapp, text),
  };
}
