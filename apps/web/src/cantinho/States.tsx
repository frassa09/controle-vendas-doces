import { Use } from './Symbols';

/** Enquanto a página abre: o brigadeiro balança na parede. */
export function Abrindo() {
  return (
    <main className="estado abrindo">
      <div className="estado-cartao" role="status">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <use href="#doce-brigadeiro" />
        </svg>
        <p>Abrindo seu cantinho…</p>
      </div>
    </main>
  );
}

/** A geladeira vazia com um bilhete em branco: o link não leva a nenhum cantinho. */
function BilheteVazio() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="112" rx="40" ry="6" fill="var(--cacau)" opacity=".1" />
      <rect
        x="30"
        y="8"
        width="60"
        height="102"
        rx="8"
        fill="#F7FAF9"
        stroke="var(--cacau)"
        strokeWidth="1.5"
      />
      <line x1="30" y1="44" x2="90" y2="44" stroke="var(--cacau)" strokeWidth="1.5" />
      <rect x="80" y="20" width="3" height="16" rx="1.5" fill="var(--madeira-2)" />
      <rect x="80" y="52" width="3" height="18" rx="1.5" fill="var(--madeira-2)" />
      <g transform="rotate(-6 56 72)">
        <rect
          x="40"
          y="56"
          width="32"
          height="34"
          rx="2"
          fill="var(--papel)"
          stroke="var(--cacau)"
          strokeWidth="1.2"
        />
        <circle cx="56" cy="57" r="3.5" style={{ fill: 'var(--loja)' }} stroke="var(--cacau)" />
        <path
          d="M46 70h20M46 77h14"
          stroke="var(--madeira)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
      </g>
    </svg>
  );
}

export function LinkNaoEncontrado() {
  return (
    <main className="estado">
      <div className="estado-cartao">
        <BilheteVazio />
        <h1>Não achamos esse cantinho</h1>
        <p>Confira se o link chegou inteiro. Se não der, peça um novo pra loja pelo WhatsApp.</p>
      </div>
    </main>
  );
}

export function SemConexao({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="estado">
      <div className="estado-cartao">
        <BilheteVazio />
        <h1>Não deu pra abrir agora</h1>
        <p>Pode ser a internet. Seus pontos e recadinhos continuam guardados.</p>
        <button className="botao botao-principal" type="button" onClick={onRetry}>
          <Use id="i-atualizar" />
          <span>Tentar de novo</span>
        </button>
      </div>
    </main>
  );
}
