import { createAuthOperations, type AuthOperations } from './auth';
import { createCollectionOperations, type CollectionOperations } from './collections';
import { createCouponOperations, type CouponOperations } from './coupons';
import { createCatalogOperations, type CatalogOperations } from './catalog';
import { createCustomerOperations, type CustomerOperations } from './customers';
import { createCustomerPageOperations, type CustomerPageOperations } from './customerPage';
import type { DbClient } from './db/client';
import { createMetricsOperations, type MetricsOperations } from './metrics';
import { createPaymentOperations, type PaymentOperations } from './payments';
import { createPointsOperations, type PointsOperations } from './points';
import { createReceiptOperations, type ReceiptOperations } from './receipts';
import { createSaleOperations, type SaleOperations } from './sales';
import { createStoreOperations, type StoreOperations } from './store';

/**
 * A interface de domínio usada pelo app e pela página do cliente. As telas só
 * conversam com o banco por aqui. Cada grupo corresponde a uma área de negócio
 * da spec (loja, catálogo, clientes, vendas...).
 */
export interface Core {
  auth: AuthOperations;
  store: StoreOperations;
  catalog: CatalogOperations;
  customers: CustomerOperations;
  sales: SaleOperations;
  payments: PaymentOperations;
  collections: CollectionOperations;
  points: PointsOperations;
  /** Mensagens de WhatsApp: recibo de pagamento e reenvio de link e PIN. */
  receipts: ReceiptOperations;
  /** Métricas de vendas, produtos e clientes por período. */
  metrics: MetricsOperations;
  /** Prêmios a entregar (resgate direto e raspadinha). */
  coupons: CouponOperations;
  /** Página pública do cliente (sem login, pelo token do link). */
  customerPage: CustomerPageOperations;
}

export interface CoreDependencies {
  /** Cliente criado com createSupabaseClient. */
  supabase: DbClient;
  /** Endereço da página do cliente, usado no link das mensagens de cobrança. */
  customerPageUrl?: string | undefined;
}

export function createCore({ supabase, customerPageUrl }: CoreDependencies): Core {
  return {
    auth: createAuthOperations(supabase),
    store: createStoreOperations(supabase),
    catalog: createCatalogOperations(supabase),
    customers: createCustomerOperations(supabase),
    sales: createSaleOperations(supabase),
    payments: createPaymentOperations(supabase),
    collections: createCollectionOperations(supabase, { customerPageUrl }),
    points: createPointsOperations(supabase),
    receipts: createReceiptOperations(supabase, { customerPageUrl }),
    metrics: createMetricsOperations(supabase),
    coupons: createCouponOperations(supabase),
    customerPage: createCustomerPageOperations(supabase),
  };
}
