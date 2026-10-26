import { useEffect, useRef, type ReactNode } from 'react';
import { Use } from './Symbols';

interface FolhaProps {
  titleId: string;
  title: string;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A folha que sobe de baixo (DESIGN.md › Folha): diálogo modal com alça, título e
 * botão de fechar. Abre ao montar; Esc, o fundo e o X chamam onClose. Reaproveitada
 * pela raspadinha.
 */
export function Folha({ titleId, title, sub, onClose, children }: FolhaProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const cancel = (event: Event) => {
      event.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener('cancel', cancel);
    return () => {
      dialog.removeEventListener('cancel', cancel);
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="folha"
      aria-labelledby={titleId}
      onClick={(event) => {
        // Toque no fundo escurecido (fora do papel) fecha.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="folha-papel">
        <div className="alca" aria-hidden="true" />
        <div className="folha-topo">
          <div>
            <h2 id={titleId}>{title}</h2>
            {sub ? <p className="folha-sub">{sub}</p> : null}
          </div>
          <button className="fechar" type="button" aria-label="Fechar" onClick={onClose}>
            <Use id="i-fechar" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
