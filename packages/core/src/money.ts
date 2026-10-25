/**
 * Dinheiro no core é sempre em centavos inteiros. Estas funções convertem de e
 * para o formato que a pessoa lê e digita (real brasileiro).
 */

/** 123456 → "R$ 1.234,56". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = (abs % 100).toString().padStart(2, '0');
  return `${sign}R$ ${reais},${centavos}`;
}

const grouped = /^\d{1,3}(\.\d{3})+$/;

/**
 * Lê um valor digitado ("8", "8,50", "R$ 1.234,56", "8.50") e devolve os centavos,
 * ou null se não for um valor em reais não negativo com até 2 casas decimais.
 */
export function parseCents(text: string): number | null {
  const value = text.replace(/^\s*R\$\s*/i, '').trim();
  if (value === '') return null;

  let whole: string;
  let fraction: string;
  const comma = value.split(',');
  if (comma.length > 2) return null;
  if (comma.length === 2) {
    [whole, fraction] = comma as [string, string];
  } else if (/^\d+\.\d{1,2}$/.test(value)) {
    // Sem vírgula, um ponto seguido de 1 ou 2 dígitos é a vírgula decimal ("8.50").
    [whole, fraction] = value.split('.') as [string, string];
  } else {
    whole = value;
    fraction = '';
  }

  if (grouped.test(whole)) whole = whole.replaceAll('.', '');
  if (!/^\d*$/.test(whole) || !/^\d{0,2}$/.test(fraction)) return null;
  if (whole === '' && fraction === '') return null;

  return Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
}
