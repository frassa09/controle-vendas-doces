import type { CustomerViewCoupon, CustomerViewScratchWin } from '@cvd/core';
import { Doce } from './Doce';
import { premioText, relativeDate } from './text';

interface PremiosProps {
  coupons: CustomerViewCoupon[];
  /** Raspadinhas ganhas sem doce escolhido. */
  wins: CustomerViewScratchWin[];
  onChooseWin: (playId: string) => void;
}

/** A caixa de presente do quarto em miniatura (papel listrado da loja, tampa loja-forte). */
function Presente() {
  return (
    <svg viewBox="0 0 40 40" width="52" height="52" aria-hidden="true" focusable="false">
      <rect
        x="7"
        y="17"
        width="26"
        height="18"
        rx="2"
        fill="url(#embrulho)"
        stroke="var(--cacau)"
        strokeWidth="1.5"
      />
      <path d="M16 17v18M24 17v18" stroke="#fff" strokeWidth="3" />
      <rect
        x="5"
        y="11"
        width="30"
        height="7"
        rx="2"
        style={{ fill: 'var(--loja-forte)' }}
        stroke="var(--cacau)"
        strokeWidth="1.5"
      />
      <path
        d="M20 11c-2-4-7-5.5-7.5-2.5S16 11 20 11c4 0 8 .5 7.5-2.5S22 7 20 11z"
        fill="var(--campo)"
        stroke="var(--cacau)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * "Seus prêmios": raspadinhas ganhas esperando a escolha do doce e os cupons ainda
 * não retirados, cada um como um cupom de papel.
 */
export function Premios({ coupons, wins, onChooseWin }: PremiosProps) {
  if (coupons.length === 0 && wins.length === 0) return null;
  return (
    <section className="secao" aria-labelledby="t-premios">
      <h2 id="t-premios">Seus prêmios</h2>
      <ul className="cupons">
        {wins.map((win) => (
          <li key={win.playId} className="cupom cupom-escolher">
            <Presente />
            <div>
              <strong>Você ganhou na raspadinha</strong>
              <span>
                Falta escolher o doce ·{' '}
                <time dateTime={win.createdAt}>{relativeDate(win.createdAt)}</time>
              </span>
              <button
                className="botao botao-secundario"
                type="button"
                onClick={() => {
                  onChooseWin(win.playId);
                }}
              >
                <span>Escolher meu doce</span>
              </button>
            </div>
          </li>
        ))}
        {coupons.map((coupon) => (
          <li key={coupon.id} className="cupom">
            <Doce name={coupon.productName} size={52} />
            <div>
              <strong>{premioText(coupon.productName)} esperando você</strong>
              <span>
                Mostre esta tela na próxima compra ·{' '}
                {coupon.origin === 'scratch' ? 'ganho na raspadinha' : 'trocado'}{' '}
                <time dateTime={coupon.createdAt}>{relativeDate(coupon.createdAt)}</time>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
