import type { CustomerView } from '@cvd/core';
import type { Ref } from 'react';
import { Use } from './Symbols';
import { docesText, itemsText, money, shortDate } from './text';

interface BilheteProps {
  ref: Ref<HTMLDivElement>;
  debt: CustomerView['debt'];
  /** Mostra o código Pix por extenso (quando copiar não funcionou). */
  showCode: boolean;
  onCopy: () => void;
}

/** O bilhete preso na geladeira: o que ficou em aberto e o Pix pra pagar. */
export function Bilhete({ ref, debt, showCode, onCopy }: BilheteProps) {
  return (
    <section className="secao" aria-labelledby="t-bilhete">
      <div className="bilhete" ref={ref} tabIndex={-1}>
        <h2 id="t-bilhete">Ficou em aberto</h2>
        <p className="valor">{money(debt.balanceCents)}</p>
        <ul className="itens">
          {debt.openSales.map((sale) => (
            <li key={sale.saleId}>
              <span>
                {shortDate(sale.createdAt)} · {itemsText(sale.items)}
              </span>
              <span>
                {money(sale.remainingCents)}
                {sale.remainingCents < sale.totalCents ? (
                  <small>de {money(sale.totalCents)}</small>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {debt.pixCode ? (
          <>
            <button className="botao botao-secundario" type="button" onClick={onCopy}>
              <Use id="i-copiar" />
              <span>Copiar código Pix</span>
            </button>
            {showCode ? (
              <p className="codigo-pix" aria-label="Código Pix copia-e-cola">
                {debt.pixCode}
              </p>
            ) : null}
          </>
        ) : (
          <p className="nota">Combine o pagamento com a loja.</p>
        )}
        <p className="nota">
          {debt.pendingPoints > 0
            ? `Quando o pagamento cair, ${debt.pendingPoints === 1 ? 'esse doce vai' : `esses ${docesText(debt.pendingPoints)} vão`} pra sua estante.`
            : 'Quando o pagamento cair, a loja dá baixa por aqui.'}
        </p>
      </div>
    </section>
  );
}
