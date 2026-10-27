/** O que o cálculo precisa de cada produto (um Product do catálogo serve). */
export interface ScratchCostProduct {
  name: string;
  priceCents: number;
  canBePrize: boolean;
  isActive: boolean;
}

export interface ScratchAverageCost {
  /** O produto-prêmio ativo mais caro (pior caso), ou null se não há prêmio. */
  worstPrize: { name: string; priceCents: number } | null;
  /** Custo médio por jogada em centavos: chance × preço do pior prêmio, arredondado. */
  averageCents: number;
}

/**
 * Custo médio estimado de uma jogada da raspadinha para a loja, no pior caso: todo
 * ganhador escolhe o produto-prêmio ativo mais caro.
 */
export function scratchAverageCost(input: {
  winPercent: number;
  products: readonly ScratchCostProduct[];
}): ScratchAverageCost {
  let worst: ScratchCostProduct | null = null;
  for (const product of input.products) {
    if (!product.canBePrize || !product.isActive) continue;
    if (!worst || product.priceCents > worst.priceCents) worst = product;
  }
  if (!worst) return { worstPrize: null, averageCents: 0 };
  return {
    worstPrize: { name: worst.name, priceCents: worst.priceCents },
    averageCents: Math.round((worst.priceCents * input.winPercent) / 100),
  };
}
