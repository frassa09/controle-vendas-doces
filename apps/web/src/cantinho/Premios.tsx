import type { CustomerViewCoupon } from '@cvd/core';
import { Doce } from './Doce';
import { premioText, relativeDate } from './text';

/** "Seus prêmios": os cupons ainda não retirados, cada um como um cupom de papel. */
export function Premios({ coupons }: { coupons: CustomerViewCoupon[] }) {
  if (coupons.length === 0) return null;
  return (
    <section className="secao" aria-labelledby="t-premios">
      <h2 id="t-premios">Seus prêmios</h2>
      <ul className="cupons">
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
