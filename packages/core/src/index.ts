export { createCore, type Core, type CoreDependencies } from './core';
export { createSupabaseClient, type DbClient, type SupabaseConnection } from './db/client';
export { CoreError, isCoreError, type CoreErrorCode, type FieldErrors } from './errors';
export {
  MIN_PASSWORD_LENGTH,
  type AuthOperations,
  type Credentials,
  type CredentialsField,
  type Member,
} from './auth';
export {
  CUSTOMER_LIMITS,
  formatWhatsApp,
  normalizeWhatsApp,
  type Customer,
  type CustomerDetailsField,
  type CustomerDetailsInput,
  type CustomerOperations,
  type CustomerSummary,
} from './customers';
export {
  INVITE_CODE_LENGTH,
  STORE_LIMITS,
  type InviteCodeField,
  type Store,
  type StoreDetailsField,
  type StoreDetailsInput,
  type StoreInvite,
  type StoreOperations,
} from './store';
export {
  PRODUCT_LIMITS,
  type CatalogOperations,
  type ListProductsOptions,
  type Product,
  type ProductField,
  type ProductInput,
} from './catalog';
export {
  SALE_LIMITS,
  unitPriceError,
  type MemberRef,
  type PaymentMethod,
  type RecordSaleInput,
  type RecordStatus,
  type Sale,
  type SaleField,
  type SaleItem,
  type SaleItemInput,
  type SaleOperations,
  type SalePayment,
  type SalePaymentInput,
} from './sales';
export { formatCents, parseCents } from './money';
