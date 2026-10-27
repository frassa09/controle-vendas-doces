import AsyncStorage from '@react-native-async-storage/async-storage';
import { backupToZip } from '@cvd/core';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { core } from '../core';

/** Dias sem exportar até o app lembrar de novo. */
export const BACKUP_REMINDER_DAYS = 7;

const DAY_MS = 86_400_000;

/** O que fica guardado no aparelho, por loja. */
interface BackupMarks {
  /** Última exportação compartilhada, ISO. */
  lastExportAt: string | null;
  /** Primeira vez que o app abriu esta loja sem exportação: começa a contar daqui. */
  since: string;
}

function keyOf(storeId: string): string {
  return `cvd:backup:${storeId}`;
}

async function readMarks(storeId: string): Promise<BackupMarks> {
  try {
    const raw = await AsyncStorage.getItem(keyOf(storeId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BackupMarks>;
      if (typeof parsed.since === 'string') {
        return { lastExportAt: parsed.lastExportAt ?? null, since: parsed.since };
      }
    }
  } catch {
    // Guardado corrompido ou ilegível: recomeça a contar.
  }
  const fresh: BackupMarks = { lastExportAt: null, since: new Date().toISOString() };
  await AsyncStorage.setItem(keyOf(storeId), JSON.stringify(fresh)).catch(() => undefined);
  return fresh;
}

export interface BackupStatus {
  lastExportAt: string | null;
  /** Passou uma semana sem exportar (contando da instalação, se nunca exportou). */
  due: boolean;
}

/** A situação do backup desta loja neste aparelho. */
export async function getBackupStatus(storeId: string, now = new Date()): Promise<BackupStatus> {
  const marks = await readMarks(storeId);
  const from = new Date(marks.lastExportAt ?? marks.since).getTime();
  return {
    lastExportAt: marks.lastExportAt,
    due: now.getTime() - from >= BACKUP_REMINDER_DAYS * DAY_MS,
  };
}

function fileStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Gera o backup (um .zip com um CSV por entidade), abre o compartilhamento do sistema
 * e anota a data. Lança se não der para gerar ou compartilhar.
 */
export async function exportEverything(storeId: string): Promise<string> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este celular não deixa compartilhar arquivos.');
  }
  const backup = await core.backup.exportBackup();
  const file = new File(Paths.cache, `backup-loja-${fileStamp(backup.createdAt)}.zip`);
  file.create({ overwrite: true });
  await file.write(backupToZip(backup));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/zip',
    dialogTitle: 'Guardar a cópia dos dados',
  });

  const marks = await readMarks(storeId);
  await AsyncStorage.setItem(
    keyOf(storeId),
    JSON.stringify({ ...marks, lastExportAt: backup.createdAt }),
  );
  return backup.createdAt;
}
