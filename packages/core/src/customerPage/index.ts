import type { DbClient } from '../db/client';
import type { CustomerView } from './customerView';
import { getCustomerView } from './getCustomerView';

export type {
  CustomerView,
  CustomerViewEntry,
  CustomerViewItem,
  CustomerViewOpenSale,
} from './customerView';

export interface CustomerPageOperations {
  /** A visão pública do cliente dono do token do link (sem login). */
  getCustomerView(token: string): Promise<CustomerView>;
}

export function createCustomerPageOperations(db: DbClient): CustomerPageOperations {
  return {
    getCustomerView: (token) => getCustomerView(db, token),
  };
}
