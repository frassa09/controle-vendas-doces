import { debtAgeDays, type CustomerBalance, type PaymentMethod } from '@cvd/core';

export const dayFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export const methodLabel: Record<PaymentMethod, string> = { pix: 'Pix', cash: 'Dinheiro' };

/** "há 15 dias", "desde hoje", "há 1 dia". */
export function ageText(days: number): string {
  if (days === 0) return 'desde hoje';
  return days === 1 ? 'há 1 dia' : `há ${String(days)} dias`;
}

/** "Em aberto desde 10/10/2026 · há 15 dias", ou null sem dívida. */
export function debtSinceText(balance: CustomerBalance): string | null {
  const days = debtAgeDays(balance);
  if (balance.debtSince === null || days === null) return null;
  const since = dayFormat.format(new Date(balance.debtSince));
  return days === 0 ? 'Em aberto desde hoje' : `Em aberto desde ${since} · ${ageText(days)}`;
}

/** "12,34", para preencher um campo de valor que já mostra o prefixo R$. */
export const centsText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** "25/10/2026, 14:30". */
export const whenFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
