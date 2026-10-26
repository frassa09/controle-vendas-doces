import type { DbClient } from '../db/client';
import { listScratchPlays, type ListScratchPlaysOptions } from './listScratchPlays';
import type { ScratchPlay } from './scratchPlay';

export {
  scratchAverageCost,
  type ScratchAverageCost,
  type ScratchCostProduct,
} from './averageCost';
export type { ListScratchPlaysOptions } from './listScratchPlays';
export type { ScratchPlay } from './scratchPlay';

export interface ScratchOperations {
  /** Jogadas da raspadinha da loja, ou só as de um cliente (`customerId`). */
  listScratchPlays(options?: ListScratchPlaysOptions): Promise<ScratchPlay[]>;
}

export function createScratchOperations(db: DbClient): ScratchOperations {
  return {
    listScratchPlays: (options) => listScratchPlays(db, options),
  };
}
