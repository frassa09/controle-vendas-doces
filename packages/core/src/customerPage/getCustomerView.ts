import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { buildPixCopyAndPaste } from '../collections/pix';
import type { DbClient } from '../db/client';
import { CoreError } from '../errors';
import type { CustomerView, CustomerViewEntry, CustomerViewItem } from './customerView';

/** Formato do token do link (gerado pelo banco: 32 bytes em hex). */
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/** O JSON devolvido por public.get_customer_page (via edge function customer-view). */
interface RawView {
  store: {
    name: string;
    brandColor: string | null;
    welcomeText: string | null;
    logo: string | null;
    pixKey: string;
    city: string;
  };
  customer: { name: string };
  points: number;
  pointsExpiresAt: string | null;
  redeemCost: number;
  scratchCost: number;
  openSales: {
    saleId: string;
    createdAt: string;
    totalCents: number;
    remainingCents: number;
    points: number;
    items: CustomerViewItem[];
  }[];
  history: {
    kind: 'sale' | 'payment';
    id: string;
    createdAt: string;
    status: 'active' | 'cancelled';
    amountCents: number;
    method: 'pix' | 'cash' | null;
    items: CustomerViewItem[] | null;
    points: number;
  }[];
}

/**
 * A visão pública do cliente pelo token do link, sem login. Lê só pela edge
 * function customer-view; a chave pública não tem acesso às tabelas.
 * Erros: LINK_NOT_FOUND (token inválido ou inexistente), NETWORK, UNEXPECTED.
 */
export async function getCustomerView(db: DbClient, token: string): Promise<CustomerView> {
  const clean = token.trim();
  if (!TOKEN_PATTERN.test(clean)) throw new CoreError('LINK_NOT_FOUND');

  const result = await db.functions.invoke<{ view: RawView }>('customer-view', {
    body: { token: clean },
  });
  const error: unknown = result.error;
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = (error.context as Response).status;
      if (status === 404) throw new CoreError('LINK_NOT_FOUND', { cause: error });
    }
    if (error instanceof FunctionsFetchError) throw new CoreError('NETWORK', { cause: error });
    throw new CoreError('UNEXPECTED', { cause: error });
  }
  if (!result.data) throw new CoreError('UNEXPECTED');
  return toCustomerView(result.data.view);
}

function toCustomerView(raw: RawView): CustomerView {
  const balanceCents = raw.openSales.reduce((sum, sale) => sum + sale.remainingCents, 0);
  return {
    store: {
      name: raw.store.name,
      brandColor: raw.store.brandColor,
      welcomeText: raw.store.welcomeText,
      logoDataUrl: raw.store.logo,
    },
    customer: {
      name: raw.customer.name,
      firstName: raw.customer.name.trim().split(/\s+/)[0] ?? raw.customer.name,
    },
    points: {
      balance: raw.points,
      expiresAt: raw.pointsExpiresAt,
      redeemCost: raw.redeemCost,
      scratchCost: raw.scratchCost,
    },
    debt: {
      balanceCents,
      pendingPoints: raw.openSales.reduce((sum, sale) => sum + sale.points, 0),
      pixCode: balanceCents > 0 ? pixFor(raw.store, balanceCents) : null,
      openSales: raw.openSales.map((sale) => ({
        saleId: sale.saleId,
        createdAt: sale.createdAt,
        totalCents: sale.totalCents,
        remainingCents: sale.remainingCents,
        items: sale.items,
      })),
    },
    history: raw.history.map(toEntry),
  };
}

function toEntry(raw: RawView['history'][number]): CustomerViewEntry {
  if (raw.kind === 'payment') {
    return {
      kind: 'payment',
      id: raw.id,
      createdAt: raw.createdAt,
      status: raw.status,
      amountCents: raw.amountCents,
      method: raw.method ?? 'pix',
      points: raw.points,
    };
  }
  return {
    kind: 'sale',
    id: raw.id,
    createdAt: raw.createdAt,
    status: raw.status,
    totalCents: raw.amountCents,
    paymentType: raw.method === null ? 'fiado' : 'paidNow',
    method: raw.method,
    items: raw.items ?? [],
    points: raw.points,
  };
}

/** Pix com o valor em aberto; sem código se a chave da loja não couber no padrão. */
function pixFor(store: RawView['store'], amountCents: number): string | null {
  try {
    return buildPixCopyAndPaste({
      key: store.pixKey,
      name: store.name,
      city: store.city,
      amountCents,
    });
  } catch {
    return null;
  }
}
