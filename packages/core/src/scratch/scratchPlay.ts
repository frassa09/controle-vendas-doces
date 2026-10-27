import type { ScratchFormat } from '../customerPage/customerView';

/** Uma jogada da raspadinha como o app a vê. Imutável depois de gravada. */
export interface ScratchPlay {
  id: string;
  customerId: string;
  format: ScratchFormat;
  won: boolean;
  /** Pontos debitados na jogada. */
  cost: number;
  /** Chance de prêmio (%) usada no sorteio. */
  winPercent: number;
  createdAt: string;
}
