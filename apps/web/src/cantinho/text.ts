import { formatCents, type CustomerViewItem, type PaymentMethod } from '@cvd/core';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Dia no fuso do aparelho, como chave comparável. */
function dayKey(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth())}-${String(date.getDate())}`;
}

/** "15 out" (com o ano só quando não é o ano corrente). */
export function shortDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const base = `${String(date.getDate())} ${MESES[date.getMonth()] ?? ''}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${String(date.getFullYear())}`;
}

/** "hoje", "ontem" ou "15 out". */
export function relativeDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (dayKey(date) === dayKey(now)) return 'hoje';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return 'ontem';
  return shortDate(iso, now);
}

/** Plural simples do português para o primeiro nome do produto ("Bolo de pote" → "Bolos de pote"). */
function pluralize(name: string): string {
  const [first = '', ...rest] = name.split(' ');
  let plural: string;
  if (/[aeiouáéíóúâêô]$/i.test(first)) plural = `${first}s`;
  else if (/ão$/i.test(first)) plural = `${first.slice(0, -2)}ões`;
  else if (/[rz]$/i.test(first)) plural = `${first}es`;
  else if (/[aeou]l$/i.test(first)) plural = `${first.slice(0, -1)}is`;
  else return name;
  return [plural, ...rest].join(' ');
}

/** "2 brownies" / "1 bolo de pote" / "2× 3 brownies" (nome que já começa com número). */
function itemText({ name, quantity }: CustomerViewItem): string {
  if (/^\d/.test(name)) return quantity === 1 ? name : `${String(quantity)}× ${name}`;
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  return `${String(quantity)} ${quantity === 1 ? lower : pluralize(lower)}`;
}

/** "2 brownies e 1 bolo de pote". */
export function itemsText(items: CustomerViewItem[]): string {
  const parts = items.map(itemText);
  if (parts.length <= 1) return parts[0] ?? 'Compra';
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1] ?? ''}`;
}

/** "R$ 12,00". */
export const money = formatCents;

/** "R$18" no bilhete miúdo da geladeira (centavos só quando há). */
export function compactMoney(cents: number): string {
  const reais = Math.floor(cents / 100);
  const rest = cents % 100;
  const inteiro = reais.toLocaleString('pt-BR');
  return rest === 0 ? `R$${inteiro}` : `R$${inteiro},${String(rest).padStart(2, '0')}`;
}

export function methodText(method: PaymentMethod): string {
  return method === 'pix' ? 'no Pix' : 'em dinheiro';
}

/** "1 brownie" / "1 bolo de pote" / "3 brownies" (nome que já começa com número). */
export function premioText(name: string): string {
  if (/^\d/.test(name)) return name;
  return `1 ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

/** "1 doce" / "3 doces". */
export function docesText(count: number): string {
  return count === 1 ? '1 doce' : `${String(count)} doces`;
}

export function pontosText(count: number): string {
  return Math.abs(count) === 1 ? `${String(count)} ponto` : `${String(count)} pontos`;
}
