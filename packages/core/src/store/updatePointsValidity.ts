import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireStoreId } from '../db/session';
import { validatePointsValidity } from './pointsValidity';
import { storeColumns, toStore, type Store } from './store';

/**
 * Define em quantos dias sem compra paga os pontos dos clientes vencem (1 a 3650),
 * ou null para não vencerem. Qualquer membro pode. Vale daqui em diante para todos
 * os saldos: o vencimento é conferido quando o saldo é lido.
 * Erros: INVALID_INPUT (pointsValidityDays), NOT_AUTHENTICATED, FORBIDDEN.
 */
export async function updatePointsValidity(db: DbClient, days: number | null): Promise<Store> {
  const validity = validatePointsValidity(days);
  const storeId = await requireStoreId(db);

  const { data, error } = await db
    .from('stores')
    .update({ points_validity_days: validity })
    .eq('id', storeId)
    .select(storeColumns)
    .single();
  if (error) throw fromDbError(error);
  return toStore(data);
}
