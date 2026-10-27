import type { DbClient } from '../db/client';
import type { Backup } from './backup';
import { exportBackup } from './exportBackup';

export { BACKUP_FILE_NAMES, type Backup, type BackupFile, type BackupFileName } from './backup';
export { toCsv, type CsvValue } from './csv';
export { backupToZip, crc32, createZip, type ZipEntry } from './zip';

export interface BackupOperations {
  /**
   * Cópia de segurança de tudo da loja, um CSV por entidade (loja, membros, produtos,
   * clientes, vendas, itens, pagamentos, pontos, cupons, raspadinhas e cobranças),
   * com os cancelados. Sem PIN nem token do link do cliente.
   */
  exportBackup(): Promise<Backup>;
}

export function createBackupOperations(db: DbClient): BackupOperations {
  return { exportBackup: () => exportBackup(db) };
}
