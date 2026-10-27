import type { CustomerViewEntry } from '@cvd/core';
import { Use } from './Symbols';
import { docesText, itemsText, methodText, money, relativeDate } from './text';

interface Line {
  icon: string;
  title: string;
  detail: string;
  gain: string | null;
  cancelled: boolean;
}

function lineOf(entry: CustomerViewEntry): Line {
  const cancelled = entry.status === 'cancelled';
  const gain = !cancelled && entry.points > 0 ? `+${docesText(entry.points)} na estante` : null;
  if (entry.kind === 'payment') {
    return {
      icon: entry.method === 'pix' ? 'i-pix' : 'i-dinheiro',
      title:
        entry.method === 'pix'
          ? `Recebemos seu Pix de ${money(entry.amountCents)}`
          : `Recebemos ${money(entry.amountCents)} em dinheiro`,
      detail: cancelled
        ? 'pagamento desfeito pela loja'
        : gain
          ? ''
          : 'abateu do que ficou em aberto',
      gain,
      cancelled,
    };
  }
  const how =
    entry.paymentType === 'fiado'
      ? 'ficou pra depois'
      : `pago ${methodText(entry.method ?? 'pix')}`;
  return {
    icon: cancelled ? 'i-desfeito' : 'i-sacola',
    title: itemsText(entry.items),
    detail: `${money(entry.totalCents)} · ${cancelled ? 'compra desfeita pela loja' : how}`,
    gain,
    cancelled,
  };
}

/** Recadinhos da loja: compras e pagamentos, do mais novo para o mais antigo. */
export function Recados({ history }: { history: CustomerViewEntry[] }) {
  return (
    <section className="secao" aria-labelledby="t-recados">
      <h2 id="t-recados">Recadinhos da loja</h2>
      {history.length === 0 ? (
        <p className="recados">
          <span className="vazio">
            Ainda não tem recadinho. Depois da sua primeira compra, ela aparece aqui.
          </span>
        </p>
      ) : (
        <ul className="recados">
          {history.map((entry) => {
            const line = lineOf(entry);
            return (
              <li
                key={`${entry.kind}-${entry.id}`}
                className={line.cancelled ? 'cancelado' : undefined}
              >
                <span className="icone">
                  <Use id={line.icon} />
                </span>
                <div>
                  <strong>{line.title}</strong>
                  {line.detail ? <span>{line.detail}</span> : null}
                  {line.gain ? <span className="ganho">{line.gain}</span> : null}
                </div>
                <time dateTime={entry.createdAt}>{relativeDate(entry.createdAt)}</time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
