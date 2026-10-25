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
  STORE_LIMITS,
  type Store,
  type StoreDetailsField,
  type StoreDetailsInput,
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
export { formatCents, parseCents } from './money';
