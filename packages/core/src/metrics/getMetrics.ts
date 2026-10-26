import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireUserId } from '../db/session';
import { CoreError } from '../errors';
import type {
  CustomerRank,
  HourMetrics,
  LapsedCustomer,
  MetricsComparison,
  MetricsOptions,
  MethodTotals,
  PeriodMetrics,
  ProductMetrics,
  WeekdayMetrics,
} from './metrics';

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
const DEFAULT_LAPSED_DAYS = 30;

/** Forma do jsonb de public.store_metrics. */
interface RawMetrics {
  salesCount: number;
  revenueCents: number;
  receivedCents: number;
  toReceiveCents: number;
  byMethod: { pix: MethodTotals; cash: MethodTotals };
  byWeekday: WeekdayMetrics[];
  byHour: HourMetrics[];
  products: ProductMetrics[];
  discounts: { totalCents: number; units: number; salesCount: number };
  customers: {
    buyersCount: number;
    customerSalesCount: number;
    walkInSalesCount: number;
    newCount: number;
    returningCount: number;
    top: CustomerRank[];
    lapsedCount: number;
    lapsed: LapsedCustomer[];
  };
}

function toPeriod(from: string, to: string, raw: RawMetrics): PeriodMetrics {
  const combos = raw.products.filter((p) => p.isCombo);
  const { customerSalesCount, ...customers } = raw.customers;
  return {
    from,
    to,
    salesCount: raw.salesCount,
    revenueCents: raw.revenueCents,
    receivedCents: raw.receivedCents,
    toReceiveCents: raw.toReceiveCents,
    averageTicketCents: raw.salesCount === 0 ? 0 : Math.round(raw.revenueCents / raw.salesCount),
    byMethod: raw.byMethod,
    byWeekday: raw.byWeekday,
    byHour: raw.byHour,
    products: raw.products,
    combos: {
      quantity: combos.reduce((sum, p) => sum + p.quantity, 0),
      revenueCents: combos.reduce((sum, p) => sum + p.revenueCents, 0),
    },
    discounts: raw.discounts,
    customers: {
      ...customers,
      averageFrequency:
        customers.buyersCount === 0
          ? 0
          : Math.round((customerSalesCount / customers.buyersCount) * 10) / 10,
    },
  };
}

async function loadPeriod(
  db: DbClient,
  from: string,
  to: string,
  timeZone: string,
  lapsedAfterDays: number,
): Promise<PeriodMetrics> {
  const { data, error } = await db.rpc('store_metrics', {
    p_from: from,
    p_to: to,
    p_time_zone: timeZone,
    p_lapsed_days: lapsedAfterDays,
  });
  if (error) throw fromDbError(error);
  return toPeriod(from, to, data as unknown as RawMetrics);
}

/**
 * Métricas do período e do período anterior equivalente. Erros: NOT_AUTHENTICATED,
 * INVALID_INPUT (datas inválidas, início depois do fim, fuso desconhecido).
 */
export async function getMetrics(
  db: DbClient,
  options: MetricsOptions,
): Promise<MetricsComparison> {
  await requireUserId(db);
  const from = new Date(options.from);
  const to = new Date(options.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    throw new CoreError('INVALID_INPUT');
  }
  const previous = options.previous ?? {
    from: new Date(from.getTime() - (to.getTime() - from.getTime())).toISOString(),
    to: from.toISOString(),
  };
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const lapsed = options.lapsedAfterDays ?? DEFAULT_LAPSED_DAYS;
  if (!Number.isInteger(lapsed) || lapsed < 1) throw new CoreError('INVALID_INPUT');

  const [period, before] = await Promise.all([
    loadPeriod(db, from.toISOString(), to.toISOString(), timeZone, lapsed),
    loadPeriod(db, previous.from, previous.to, timeZone, lapsed),
  ]);
  return { period, previous: before };
}
