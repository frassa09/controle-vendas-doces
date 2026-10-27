import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

export type FocusQuery<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'ready'; data: T; error: undefined }
  | { status: 'error'; data: T | undefined; error: unknown };

/**
 * Lê dados do core sempre que a tela ganha foco (ex.: ao voltar de uma edição) e
 * quando `load` muda. Mantém o último resultado enquanto recarrega e ignora
 * respostas que chegam fora de ordem. Com `once`, lê só até dar certo uma vez
 * (formulários de edição, que não podem perder o que já foi digitado).
 */
export function useFocusQuery<T>(load: () => Promise<T>, options: { once?: boolean } = {}) {
  const { once = false } = options;
  const [state, setState] = useState<FocusQuery<T>>({
    status: 'loading',
    data: undefined,
    error: undefined,
  });
  const latest = useRef(0);
  const loaded = useRef(false);

  const run = useCallback(async () => {
    const request = ++latest.current;
    try {
      const data = await load();
      if (request === latest.current) {
        loaded.current = true;
        setState({ status: 'ready', data, error: undefined });
      }
    } catch (error) {
      if (request === latest.current) {
        setState((current) => ({ status: 'error', data: current.data, error }));
      }
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (once && loaded.current) return;
      void run();
    }, [run, once]),
  );

  return { ...state, reload: run };
}
