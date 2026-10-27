import { isCoreError } from '@cvd/core';
import { useCallback, useRef, useState } from 'react';
import { useFocusQuery } from '../ui/useFocusQuery';
import { exportEverything, getBackupStatus } from './backup';

const fallbackMessage = 'Não deu para gerar a cópia. Confira a internet e tente de novo.';

/**
 * Situação do backup (relida sempre que a tela ganha foco) e a ação de exportar tudo.
 */
export function useBackup(storeId: string) {
  const status = useFocusQuery(useCallback(() => getBackupStatus(storeId), [storeId]));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const exportAll = async () => {
    if (busy.current) return;
    busy.current = true;
    setExporting(true);
    setError(null);
    try {
      await exportEverything(storeId);
      await status.reload();
    } catch (cause) {
      setError(isCoreError(cause) ? cause.message : fallbackMessage);
    } finally {
      busy.current = false;
      setExporting(false);
    }
  };

  return {
    lastExportAt: status.data?.lastExportAt ?? null,
    due: status.data?.due ?? false,
    exporting,
    error,
    exportAll,
  };
}
