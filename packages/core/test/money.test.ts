import { describe, expect, it } from 'vitest';
import { formatCents, parseCents } from '../src';

describe('mostrar valores em reais', () => {
  it.each([
    [800, 'R$ 8,00'],
    [850, 'R$ 8,50'],
    [5, 'R$ 0,05'],
    [0, 'R$ 0,00'],
    [123456, 'R$ 1.234,56'],
    [1000000, 'R$ 10.000,00'],
    [-250, '-R$ 2,50'],
  ])('%i centavos viram %s', (cents, text) => {
    expect(formatCents(cents)).toBe(text);
  });
});

describe('ler o valor digitado', () => {
  it.each([
    ['8', 800],
    ['8,5', 850],
    ['8,50', 850],
    [' R$ 8,50 ', 850],
    ['0,05', 5],
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['8.50', 850],
    ['1.000', 100000],
    [',50', 50],
  ])('"%s" vira %i centavos', (text, cents) => {
    expect(parseCents(text)).toBe(cents);
  });

  it.each(['', '   ', 'abc', '8,555', '8,5,0', '-3', '1.2.3,4', 'R$'])(
    '"%s" não é um valor',
    (text) => {
      expect(parseCents(text)).toBeNull();
    },
  );
});
