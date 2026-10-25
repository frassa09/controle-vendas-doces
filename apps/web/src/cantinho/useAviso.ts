import { useCallback, useEffect, useRef, useState } from 'react';

/** O aviso (toast) cacau no rodapé: aparece e some sozinho depois de 2,6 s. */
export function useAviso() {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setMessage(text);
    setVisible(true);
    timer.current = window.setTimeout(() => {
      setVisible(false);
    }, 2600);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  return { message, visible, show };
}
