import type { MetricsOptions } from '@cvd/core';

export type PeriodKind = 'day' | 'week' | 'month' | 'range';

export interface PeriodChoice {
  kind: PeriodKind;
  /** Um dia dentro do período (dia/semana/mês) ou o primeiro dia do intervalo. */
  anchor: Date;
  /** Último dia do intervalo (só em `range`). */
  end?: Date;
}

const DAY_MS = 86_400_000;

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

/** Semana de segunda a domingo. */
const startOfWeek = (date: Date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7));

interface Bounds {
  from: Date;
  to: Date;
}

/** Início (inclusive) e fim (exclusivo) do período escolhido, no horário do aparelho. */
export function boundsOf(choice: PeriodChoice): Bounds {
  const { kind, anchor } = choice;
  if (kind === 'day') {
    const from = startOfDay(anchor);
    return { from, to: addDays(from, 1) };
  }
  if (kind === 'week') {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  if (kind === 'month') {
    const from = addMonths(anchor, 0);
    return { from, to: addMonths(anchor, 1) };
  }
  const from = startOfDay(anchor);
  return { from, to: addDays(startOfDay(choice.end ?? anchor), 1) };
}

/** O período anterior equivalente: dia, semana ou mês anterior; no intervalo, o mesmo tamanho. */
export function previousBounds(choice: PeriodChoice): Bounds {
  const { from, to } = boundsOf(choice);
  if (choice.kind === 'day') return { from: addDays(from, -1), to: from };
  if (choice.kind === 'week') return { from: addDays(from, -7), to: from };
  if (choice.kind === 'month') return { from: addMonths(from, -1), to: from };
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  return { from: addDays(from, -days), to: from };
}

/** As opções do core para a escolha, com o fuso do aparelho. */
export function metricsOptionsOf(choice: PeriodChoice): MetricsOptions {
  const { from, to } = boundsOf(choice);
  const before = previousBounds(choice);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    previous: { from: before.from.toISOString(), to: before.to.toISOString() },
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/** Move o período para o anterior (-1) ou o próximo (+1). Não anda para o futuro. */
export function shiftChoice(choice: PeriodChoice, direction: -1 | 1): PeriodChoice {
  const { kind, anchor } = choice;
  if (kind === 'day') return { kind, anchor: addDays(anchor, direction) };
  if (kind === 'week') return { kind, anchor: addDays(anchor, 7 * direction) };
  if (kind === 'month') return { kind, anchor: addMonths(anchor, direction) };
  const { from, to } = boundsOf(choice);
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  return {
    kind,
    anchor: addDays(from, days * direction),
    end: addDays(from, days * direction + days - 1),
  };
}

/** Se o período já é o atual (ou futuro): então "próximo" não faz sentido. */
export function isCurrentOrFuture(choice: PeriodChoice, now: Date): boolean {
  return boundsOf(choice).to.getTime() > now.getTime();
}

const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const dayMonthYear = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

/** Rótulo do período: "Hoje", "09/03 a 15/03", "março de 2026". */
export function labelOf(choice: PeriodChoice, now: Date): string {
  const { from, to } = boundsOf(choice);
  const last = addDays(to, -1);
  if (choice.kind === 'day') {
    const diff = Math.round((startOfDay(now).getTime() - from.getTime()) / DAY_MS);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    return dayMonthYear.format(from);
  }
  if (choice.kind === 'month') return monthYear.format(from);
  return `${dayMonth.format(from)} a ${dayMonthYear.format(last)}`;
}

/** Lê "dd/mm/aaaa" (ou "dd/mm", no ano de `now`). Null se inválido. */
export function parseDay(text: string, now: Date): Date | null {
  const match = /^\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*$/.exec(text);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3] ? Number(match[3]) : now.getFullYear();
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Variação em relação ao período anterior, como texto. Null quando o anterior é zero
 * (não há base para percentual).
 */
export function deltaText(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return 'igual ao período anterior';
  return `${pct > 0 ? '+' : '−'}${String(Math.abs(pct))}% sobre o período anterior`;
}
