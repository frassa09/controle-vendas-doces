/** Faixas de atraso do filtro da fila (dias desde a venda mais antiga em aberto). */
export type CollectionRange = 'all' | 'upTo7' | 'upTo30' | 'over30';

/** Um devedor na fila de cobrança. */
export interface CollectionQueueItem {
  customerId: string;
  name: string;
  /** Normalizado: 55 + DDD + número. */
  whatsapp: string;
  /** Quanto o cliente deve, em centavos (sempre maior que zero). */
  balanceCents: number;
  /** Quando foi feita a venda mais antiga ainda não quitada. */
  debtSince: string;
  /** Há quantos dias a dívida está aberta. */
  daysOpen: number;
  /** Quando a última cobrança foi enviada, ou null se nunca. */
  lastCollectionAt: string | null;
}

export interface CollectionQueueOptions {
  /** Padrão: 'all'. */
  range?: CollectionRange;
}

/** A faixa (sem 'all') de uma dívida com `daysOpen` dias: até 7, de 8 a 30, mais de 30. */
export function collectionRangeOf(daysOpen: number): Exclude<CollectionRange, 'all'> {
  if (daysOpen <= 7) return 'upTo7';
  if (daysOpen <= 30) return 'upTo30';
  return 'over30';
}
