import type { DbClient } from '../db/client';
import { getMetrics } from './getMetrics';
import type { MetricsComparison, MetricsOptions } from './metrics';

export type {
  CustomerRank,
  HourMetrics,
  LapsedCustomer,
  MethodTotals,
  MetricsComparison,
  MetricsOptions,
  PeriodMetrics,
  ProductMetrics,
  WeekdayMetrics,
} from './metrics';

export interface MetricsOperations {
  /** Métricas de vendas, produtos e clientes do período e do anterior (cancelados fora). */
  getMetrics(options: MetricsOptions): Promise<MetricsComparison>;
}

export function createMetricsOperations(db: DbClient): MetricsOperations {
  return { getMetrics: (options) => getMetrics(db, options) };
}
