import { buildWhatsAppUrl } from '../collections/collectionMessage';
import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { isUuid } from '../db/ids';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import { formatCents } from '../money';
import { getCustomerBalance } from '../payments/getCustomerBalance';
import { getPayment } from '../payments/getPayment';

/** Mensagem pronta para o WhatsApp do cliente e o link que a abre. */
export interface WhatsAppMessage {
  customerId: string;
  customerName: string;
  text: string;
  /** https://wa.me/<número>?text=<mensagem> */
  whatsappUrl: string;
}

/** Recibo de um pagamento: a mensagem e os números que ela mostra. */
export interface PaymentReceipt extends WhatsAppMessage {
  paymentId: string;
  amountCents: number;
  /** Pontos que esse pagamento rendeu (vendas que ele quitou); 0 em pagamento parcial. */
  pointsEarned: number;
  /** Saldo de pontos do cliente agora. */
  pointsBalance: number;
  /** Quanto o cliente ainda deve depois do pagamento. */
  balanceCents: number;
}

export interface ReceiptSettings {
  /** Endereço da página do cliente; sem ele, a linha do link some. */
  customerPageUrl?: string | undefined;
}

function pointsText(points: number): string {
  return `${String(points)} ${Math.abs(points) === 1 ? 'ponto' : 'pontos'}`;
}

function linkLine(settings: ReceiptSettings, token: string): string | null {
  const base = settings.customerPageUrl?.replace(/\/+$/, '') ?? '';
  return base === '' ? null : `${base}/c/${token}`;
}

async function loadCustomer(db: DbClient, customerId: string) {
  const { data, error } = await db
    .from('customers')
    .select('name, whatsapp, pin, link_token')
    .eq('id', customerId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new CoreError('CUSTOMER_NOT_FOUND');
  return data;
}

/**
 * Monta o recibo de um pagamento: valor recebido, pontos ganhos nele (as vendas que
 * ele quitou, lidas do livro de pontos na mesma transação), saldo de pontos e link.
 * Erros: NOT_AUTHENTICATED, PAYMENT_NOT_FOUND, PAYMENT_CANCELLED, CUSTOMER_NOT_FOUND
 * (pagamento de venda avulsa não tem cliente).
 */
export async function buildPaymentReceipt(
  db: DbClient,
  paymentId: string,
  settings: ReceiptSettings,
): Promise<PaymentReceipt> {
  await requireUserId(db);
  const payment = await getPayment(db, paymentId);
  if (payment.status === 'cancelled') throw new CoreError('PAYMENT_CANCELLED');
  if (payment.customerId === null || !isUuid(payment.customerId)) {
    throw new CoreError('CUSTOMER_NOT_FOUND');
  }
  const customerId = payment.customerId;

  const [customer, balance, ledger] = await Promise.all([
    loadCustomer(db, customerId),
    getCustomerBalance(db, customerId),
    db.from('points_ledger').select('points, created_at').eq('customer_id', customerId),
  ]);
  if (ledger.error) throw fromDbError(ledger.error);

  // Pagamento e créditos nascem na mesma transação, com o mesmo created_at do banco.
  const paidAt = Date.parse(payment.createdAt);
  const pointsEarned = ledger.data
    .filter((row) => Date.parse(row.created_at) === paidAt)
    .reduce((sum, row) => sum + row.points, 0);
  const pointsBalance = ledger.data.reduce((sum, row) => sum + row.points, 0);

  const lines = [
    `Oi, ${customer.name}! Recebi o seu pagamento de ${formatCents(payment.amountCents)}. Muito obrigada!`,
  ];
  if (balance.balanceCents > 0) {
    lines.push('', `Ainda ficou faltando ${formatCents(balance.balanceCents)}, sem pressa.`);
  } else {
    lines.push('', 'Sua conta está quitada.');
  }
  lines.push(
    '',
    `Pontos ganhos agora: ${pointsText(pointsEarned)}`,
    `Seu saldo: ${pointsText(pointsBalance)}`,
  );
  const link = linkLine(settings, customer.link_token);
  if (link !== null) lines.push('', `Seu cantinho, com tudo direitinho: ${link}`);
  const text = lines.join('\n');

  return {
    customerId,
    customerName: customer.name,
    text,
    whatsappUrl: buildWhatsAppUrl(customer.whatsapp, text),
    paymentId: payment.id,
    amountCents: payment.amountCents,
    pointsEarned,
    pointsBalance,
    balanceCents: balance.balanceCents,
  };
}

/**
 * Monta a mensagem de reenvio do acesso: o link da página e o PIN do cliente.
 * Erros: NOT_AUTHENTICATED, CUSTOMER_NOT_FOUND.
 */
export async function buildAccessMessage(
  db: DbClient,
  customerId: string,
  settings: ReceiptSettings,
): Promise<WhatsAppMessage> {
  await requireUserId(db);
  if (!isUuid(customerId)) throw new CoreError('CUSTOMER_NOT_FOUND');
  const customer = await loadCustomer(db, customerId);

  const lines = [`Oi, ${customer.name}! Aqui está o seu acesso ao cantinho:`, ''];
  const link = linkLine(settings, customer.link_token);
  if (link !== null) lines.push(`Link: ${link}`);
  lines.push(`PIN: ${customer.pin}`, '', 'Guarde com carinho e não passe para ninguém.');
  const text = lines.join('\n');

  return {
    customerId,
    customerName: customer.name,
    text,
    whatsappUrl: buildWhatsAppUrl(customer.whatsapp, text),
  };
}
