import type { DbClient } from '../db/client';
import { getMetrics } from './getMetrics';
import type { MetricsComparison, MetricsOptions } from './metrics';

export type {
  CollectionMetrics,
  CustomerRank,
  DebtBand,
  HourMetrics,
  LapsedCustomer,
  LoyaltyMetrics,
  PrizeTotals,
  MethodTotals,
  MetricsComparison,
  MetricsOptions,
  PeriodMetrics,
  ProductMetrics,
  WeekdayMetrics,
} from './metrics';

export interface MetricsOperations {
  /** Métricas de vendas, produtos, clientes, cobrança e fidelidade do período e do anterior (cancelados fora). */
  getMetrics(options: MetricsOptions): Promise<MetricsComparison>;
}

export function createMetricsOperations(db: DbClient): MetricsOperations {
  return { getMetrics: (options) => getMetrics(db, options) };
}
