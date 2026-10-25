import { converter, formatHex, type Oklab } from 'culori';

/**
 * Receitas de cor do DESIGN.md ("Receita, Não Paleta"): todo tom tingido pela loja
 * deriva da cor-semente. Mistura em oklab, travas em oklch, como no CSS canônico.
 */

/** Cor padrão das lojas sem cor escolhida (framboesa). */
export const DEFAULT_STORE_COLOR = '#D6336C';

/** Materiais fixos do mundo, iguais em qualquer loja. */
export const materials = {
  cacau: '#4A2E22',
  cacau2: '#6E4E40',
  madeira: '#E6C196',
  madeira2: '#C38F5D',
  papel: '#FFFEFB',
  campo: '#FFFFFF',
  sucesso: '#2F7D57',
} as const;

export interface StoreColors {
  /** A semente crua. Só para objetos ilustrados, nunca atrás de texto. */
  loja: string;
  /** Texto e ação: botão principal, foco, títulos tingidos. Branco por cima ≥ 6,5:1. */
  forte: string;
  forteHover: string;
  /** Fundos suaves tingidos (ícones, halos). */
  suave: string;
  /** Fundo tingido que nunca desbota. */
  parede: string;
}

const toOklab = converter('oklab');
const toOklch = converter('oklch');

function parse(hex: string): Oklab {
  const color = toOklab(hex);
  if (!color) throw new Error(`Cor inválida: ${hex}`);
  return color;
}

/** color-mix(in oklab, a weight, b) */
function mix(a: Oklab, b: Oklab, weight: number): Oklab {
  return {
    mode: 'oklab',
    l: a.l * weight + b.l * (1 - weight),
    a: a.a * weight + b.a * (1 - weight),
    b: a.b * weight + b.b * (1 - weight),
  };
}

function withLch(color: Oklab, adjust: (l: number, c: number) => { l: number; c: number }): string {
  const lch = toOklch(color);
  const { l, c } = adjust(lch.l, lch.c);
  return formatHex({ ...lch, l, c });
}

export function deriveStoreColors(seedHex: string = DEFAULT_STORE_COLOR): StoreColors {
  const loja = parse(seedHex);
  const white = parse('#ffffff');

  const forte = withLch(mix(loja, parse('#2a1410'), 0.76), (l, c) => ({ l: Math.min(l, 0.47), c }));

  return {
    loja: formatHex(loja),
    forte,
    forteHover: formatHex(mix(parse(forte), parse('#000000'), 0.88)),
    suave: formatHex(mix(loja, white, 0.14)),
    parede: withLch(mix(loja, white, 0.13), (l, c) => ({ l, c: Math.max(c, 0.05) })),
  };
}
