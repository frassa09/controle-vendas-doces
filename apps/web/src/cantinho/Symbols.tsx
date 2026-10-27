import type { ReactNode } from 'react';

/** Desenhos reaproveitados (doces e ícones de traço), definidos uma vez na página. */
export function Symbols() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="doce-brownie" viewBox="0 0 40 30">
          <rect
            x="2"
            y="6"
            width="36"
            height="22"
            rx="5"
            fill="var(--brownie)"
            stroke="var(--cacau)"
            strokeWidth="1.5"
          />
          <path
            d="M2 11 Q2 6 7 6 H33 Q38 6 38 11 V14 L33 17 L27 13 L20 17 L13 13 L7 17 L2 14 Z"
            fill="var(--brownie-topo)"
          />
          <path
            d="M10 9 L14 10 M23 8 L26 10 M30 11 L33 10"
            stroke="#9A5A38"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </symbol>
        <symbol id="doce-brigadeiro" viewBox="0 0 40 40">
          <path
            d="M6 22 L10 36 Q20 39 30 36 L34 22 Z"
            fill="var(--loja)"
            stroke="var(--cacau)"
            strokeWidth="1.5"
          />
          <circle
            cx="20"
            cy="19"
            r="12"
            fill="var(--brownie)"
            stroke="var(--cacau)"
            strokeWidth="1.5"
          />
          <g fill="#F3D9A4">
            <rect x="14" y="12" width="4" height="1.6" rx=".8" transform="rotate(30 16 13)" />
            <rect x="22" y="11" width="4" height="1.6" rx=".8" transform="rotate(-25 24 12)" />
            <rect x="25" y="18" width="4" height="1.6" rx=".8" transform="rotate(70 27 19)" />
            <rect x="12" y="20" width="4" height="1.6" rx=".8" transform="rotate(-40 14 21)" />
            <rect x="19" y="23" width="4" height="1.6" rx=".8" />
            <rect x="18" y="16" width="4" height="1.6" rx=".8" transform="rotate(85 20 17)" />
          </g>
        </symbol>
        <symbol id="doce-pote" viewBox="0 0 40 40">
          <rect
            x="9"
            y="6"
            width="22"
            height="6"
            rx="2"
            fill="var(--loja)"
            stroke="var(--cacau)"
            strokeWidth="1.5"
          />
          <path
            d="M10 12 H30 L28 35 Q20 37 12 35 Z"
            fill="#fff"
            stroke="var(--cacau)"
            strokeWidth="1.5"
          />
          <path d="M11 17 H29 L28.6 22 H11.4 Z" fill="var(--brownie)" />
          <path d="M11.4 22 H28.6 L28.2 27 H11.8 Z" fill="#F6E7C8" />
          <path d="M11.8 27 H28.2 L27.9 31 H12.1 Z" fill="var(--brownie-topo)" />
        </symbol>
        <Icon id="i-fechar">
          <path d="M6 6l12 12M18 6L6 18" />
        </Icon>
        <Icon id="i-copiar">
          <rect x="8" y="8" width="12" height="12" rx="3" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </Icon>
        <Icon id="i-presente">
          <rect x="3.5" y="9" width="17" height="11" rx="2" />
          <path d="M2.5 9h19M12 9v11" />
          <path d="M12 9c-1.5-3-5-4-5.5-1.5S9 9 12 9c3 0 5.8.5 5.5-1.5S13.5 6 12 9z" />
        </Icon>
        <Icon id="i-estante">
          <path d="M3 10h18M3 19h18" />
          <rect x="5" y="5" width="4" height="5" rx="1" />
          <rect x="11" y="6.5" width="4" height="3.5" rx="1" />
          <rect x="6" y="14" width="5" height="5" rx="1" />
        </Icon>
        <Icon id="i-pix">
          <path d="M12 3l4 4-4 4-4-4z" />
          <path d="M12 13l4 4-4 4-4-4z" />
          <path d="M3 12l4-4 4 4-4 4zM13 12l4-4 4 4-4 4z" />
        </Icon>
        <Icon id="i-dinheiro">
          <rect x="3" y="6.5" width="18" height="11" rx="2.5" />
          <circle cx="12" cy="12" r="2.6" />
          <path d="M6.5 9.5v.01M17.5 14.5v.01" />
        </Icon>
        <Icon id="i-sacola">
          <path d="M5 8h14l-1 12H6z" />
          <path d="M9 10V7a3 3 0 0 1 6 0v3" />
        </Icon>
        <Icon id="i-desfeito">
          <path d="M5 8h14l-1 12H6z" />
          <path d="M9.5 12.5l5 5M14.5 12.5l-5 5" />
        </Icon>
        <Icon id="i-atualizar">
          <path d="M20 11a8 8 0 1 0-2.3 5.7" />
          <path d="M20 5v6h-6" />
        </Icon>
      </defs>
    </svg>
  );
}

function Icon({ id, children }: { id: string; children: ReactNode }) {
  return (
    <symbol id={id} viewBox="0 0 24 24">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
    </symbol>
  );
}

/** Um ícone de traço de 22px (ou o tamanho do CSS). */
export function Use({ id }: { id: string }) {
  return (
    <svg aria-hidden="true" focusable="false">
      <use href={`#${id}`} />
    </svg>
  );
}
