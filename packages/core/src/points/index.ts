import type { DbClient } from '../db/client';
import { getCustomerPoints } from './getCustomerPoints';
import type { CustomerPoints } from './points';

export type { CustomerPoints, PointsMovement, PointsMovementKind } from './points';

export interface PointsOperations {
  /** Saldo de pontos do cliente e o extrato (créditos por venda quitada). */
  getCustomerPoints(customerId: string): Promise<CustomerPoints>;
}

export function createPointsOperations(db: DbClient): PointsOperations {
  return { getCustomerPoints: (customerId) => getCustomerPoints(db, customerId) };
}
