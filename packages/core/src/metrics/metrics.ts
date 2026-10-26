/** Total por forma de pagamento. */
export interface MethodTotals {
  /** Quantidade de pagamentos. */
  count: number;
  cents: number;
}

export interface WeekdayMetrics {
  /** 0 = domingo ... 6 = sábado. */
  weekday: number;
  salesCount: number;
  revenueCents: number;
}

export interface HourMetrics {
  /** 0 a 23, no fuso pedido. */
  hour: number;
  salesCount: number;
  revenueCents: number;
}

export interface ProductMetrics {
  productId: string;
  name: string;
  isCombo: boolean;
  /** Unidades vendidas. */
  quantity: number;
  revenueCents: number;
  /** Quanto se deixou de cobrar em relação ao preço atual do produto. */
  discountCents: number;
}

export interface CustomerRank {
  customerId: string;
  name: string;
  salesCount: number;
  totalCents: number;
}

export interface LapsedCustomer extends CustomerRank {
  /** Última compra, ISO. */
  lastPurchaseAt: string;
}

/** As métricas de um período [from, to). Só vendas e pagamentos ativos entram. */
export interface PeriodMetrics {
  from: string;
  to: string;
  salesCount: number;
  /** Soma das vendas ativas do período. */
  revenueCents: number;
  /** Pagamentos ativos feitos no período (inclui pagamento de dívida). */
  receivedCents: number;
  /** O que ainda falta pagar das vendas do período. */
  toReceiveCents: number;
  /** revenueCents / salesCount, arredondado (0 sem vendas). */
  averageTicketCents: number;
  /** Recebido por forma de pagamento. */
  byMethod: { pix: MethodTotals; cash: MethodTotals };
  /** Sempre 7 posições, domingo a sábado. */
  byWeekday: WeekdayMetrics[];
  /** Sempre 24 posições. */
  byHour: HourMetrics[];
  /** Produtos e combos vendidos, mais unidades primeiro. */
  products: ProductMetrics[];
  /** Quanto se vendeu de combos. */
  combos: { quantity: number; revenueCents: number };
  discounts: { totalCents: number; units: number; salesCount: number };
  customers: {
    /** Clientes distintos que compraram. */
    buyersCount: number;
    /** Vendas sem cliente. */
    walkInSalesCount: number;
    /** Primeira compra deles foi neste período. */
    newCount: number;
    /** Já tinham comprado antes do período. */
    returningCount: number;
    /** Compras por cliente que comprou (0 sem compradores), uma casa decimal. */
    averageFrequency: number;
    /** Os 10 que mais compraram no período. */
    top: CustomerRank[];
    /** Quantos estão sem comprar há mais de `lapsedAfterDays`. */
    lapsedCount: number;
    /** Os 10 sumidos que mais já gastaram. */
    lapsed: LapsedCustomer[];
  };
}

export interface MetricsComparison {
  period: PeriodMetrics;
  /** O período anterior equivalente. */
  previous: PeriodMetrics;
}

export interface MetricsOptions {
  /** Início do período (inclusive), ISO. */
  from: string;
  /** Fim do período (exclusivo), ISO. */
  to: string;
  /** Padrão: o mesmo tamanho, logo antes de `from`. */
  previous?: { from: string; to: string };
  /** Fuso IANA para dia da semana e horário. Padrão America/Sao_Paulo. */
  timeZone?: string;
  /** Dias sem comprar para virar "sumido". Padrão 30. */
  lapsedAfterDays?: number;
}
