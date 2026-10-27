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

/** Dívida em aberto numa faixa de atraso. */
export interface DebtBand {
  cents: number;
  /** Clientes com alguma venda em aberto nesta faixa. */
  customersCount: number;
}

/**
 * Cobrança: foto da carteira de fiado no fim do período (ou agora, se ele não acabou),
 * com vendas e pagamentos ativos criados até esse instante. "Fiado" de uma venda é o
 * que não foi pago na hora; pagamentos de dívida quitam as vendas mais antigas primeiro.
 */
export interface CollectionMetrics {
  /** Total em aberto no fim do período. */
  openCents: number;
  /** Clientes devendo no fim do período. */
  debtorsCount: number;
  /** Em aberto pela idade da venda, nas faixas da fila: até 7, de 8 a 30, mais de 30 dias. */
  debtByAge: { upTo7: DebtBand; upTo30: DebtBand; over30: DebtBand };
  /** Vendas fiado que terminaram de ser quitadas dentro do período. */
  settledCount: number;
  /** Média de dias entre a venda fiado e a quitação, das quitadas no período (null sem nenhuma). */
  averageDaysToPay: number | null;
  /**
   * Inadimplência: do valor vendido fiado há mais de `overdueDays` dias (contados até o
   * fim do período), a parte que continua em aberto. Dívida mais nova ainda está no
   * prazo normal e não entra.
   */
  defaultRate: {
    /** 30: a faixa "mais de 30 dias" da fila. */
    overdueDays: number;
    /** Fiado das vendas com mais de `overdueDays` dias. */
    fiadoCents: number;
    /** Quanto desse fiado segue em aberto (igual a `debtByAge.over30.cents`). */
    openCents: number;
    /** openCents / fiadoCents em %, uma casa decimal (null sem fiado nessa idade). */
    percent: number | null;
  };
}

/** Prêmios entregues de uma origem. */
export interface PrizeTotals {
  count: number;
  cents: number;
}

/** Fidelidade: movimentos de pontos, jogadas e prêmios entregues dentro do período. */
export interface LoyaltyMetrics {
  points: {
    /** Créditos de vendas quitadas (inclui ajuste positivo de venda editada). */
    issued: number;
    /** Estornos de vendas canceladas, editadas para menos ou reabertas. */
    reversed: number;
    /** Gastos na troca direta por produto. */
    redeemed: number;
    /** Gastos na raspadinha. */
    scratched: number;
    /** Vencidos pela validade da loja (contam na data em que venceram). */
    expired: number;
  };
  scratch: {
    plays: number;
    wins: number;
    /** wins / plays em %, uma casa decimal (null sem jogadas). */
    winPercent: number | null;
    /** Média da chance configurada na hora de cada jogada (null sem jogadas). */
    configuredPercent: number | null;
  };
  /**
   * Custo da fidelidade: cupons entregues no período, pelo preço atual do produto
   * (o cupom guarda o produto, não o preço da hora).
   */
  prizes: {
    count: number;
    costCents: number;
    redemption: PrizeTotals;
    scratch: PrizeTotals;
  };
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
  collection: CollectionMetrics;
  loyalty: LoyaltyMetrics;
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
