import type { CustomerView } from '@cvd/core';
import { useRef, useState } from 'react';
import { Bilhete } from './Bilhete';
import { Recados } from './Recados';
import { Room, SHELF_SLOTS } from './Room';
import { Use } from './Symbols';
import { docesText, money, pontosText } from './text';
import { useAviso } from './useAviso';

interface CantinhoProps {
  view: CustomerView;
  /** Doces que chegaram desde a última visita; null na primeira visita. */
  arrivedSinceLastVisit: number | null;
}

/** Copia o texto; devolve false se o navegador não deixar. */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function scrollBehavior(): ScrollBehavior {
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/** A página do cliente: o quartinho, o placar, o caminho até o próximo doce e o histórico. */
export function Cantinho({ view, arrivedSinceLastVisit }: CantinhoProps) {
  const { store, customer, points, debt } = view;
  const aviso = useAviso();
  const bilheteRef = useRef<HTMLDivElement>(null);
  const [pixFailed, setPixFailed] = useState(false);

  const balance = points.balance;
  const filled = Math.max(0, Math.min(balance, SHELF_SLOTS));
  const extra = Math.max(0, balance - SHELF_SLOTS);
  const goal = points.redeemCost;
  const missing = Math.max(goal - balance, 0);
  const missingScratch = Math.max(points.scratchCost - balance, 0);
  const hasDebt = debt.balanceCents > 0;
  // O principal é sempre o caminho até o próximo doce: pagar o que está aberto, ou trocar.
  const redeemIsPrimary = !hasDebt && missing === 0;

  const firstVisit = arrivedSinceLastVisit === null;
  const arrived = firstVisit ? filled : Math.min(arrivedSinceLastVisit, filled);

  const lead =
    store.welcomeText ??
    (missing === 0
      ? 'Sua estante tá cheia: pode trocar por um doce grátis.'
      : `Mais ${docesText(missing)} na estante e o próximo é por nossa conta.`);

  const roomDescription = [
    `Um quartinho com uma estante de ${String(SHELF_SLOTS)} lugares na parede.`,
    `${String(filled)} ${filled === 1 ? 'lugar tem' : 'lugares têm'} um brownie e ${String(SHELF_SLOTS - filled)} ${SHELF_SLOTS - filled === 1 ? 'está vazio' : 'estão vazios'}.`,
    extra > 0 ? `Mais ${String(extra)} guardados.` : '',
    'No chão, uma caixa de presente da raspadinha.',
    hasDebt ? `Na geladeira, um bilhete com ${money(debt.balanceCents)} em aberto.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const goToBilhete = () => {
    const bilhete = bilheteRef.current;
    if (!bilhete) return;
    bilhete.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    bilhete.focus({ preventScroll: true });
  };

  const copyPix = async () => {
    if (!debt.pixCode) {
      goToBilhete();
      return;
    }
    if (await copy(debt.pixCode)) {
      aviso.show('Pix copiado. É só colar no app do banco.');
    } else {
      setPixFailed(true);
      aviso.show('Não deu pra copiar. O código está no bilhete.');
      goToBilhete();
    }
  };

  // Troca e raspadinha pela página chegam nos próximos passos; os pontos ficam guardados.
  const redeem = () => {
    if (missing > 0) {
      aviso.show(`Faltam ${pontosText(missing)} pra trocar por um doce.`);
      return;
    }
    aviso.show('Logo dá pra trocar por aqui. Por enquanto, peça na loja.');
  };
  const scratch = () => {
    if (missingScratch > 0) {
      aviso.show(`Faltam ${pontosText(missingScratch)} pra raspar.`);
      return;
    }
    aviso.show('A raspadinha chega logo. Seus pontos estão guardados.');
  };

  return (
    <>
      <main className="pagina">
        <header className="topo">
          <div className="marca">
            {store.logoDataUrl ? (
              <img src={store.logoDataUrl} alt="" width="32" height="32" />
            ) : (
              <svg viewBox="0 0 40 40" aria-hidden="true">
                <use href="#doce-brigadeiro" />
              </svg>
            )}
            <span>{store.name}</span>
          </div>
          <p className="saldo">
            <b>{balance}</b>
            <span>{Math.abs(balance) === 1 ? 'ponto' : 'pontos'}</span>
          </p>
        </header>

        <Room
          storeName={store.name}
          filled={filled}
          extra={extra}
          arrived={arrived}
          showPlus={!firstVisit}
          debtCents={debt.balanceCents}
          scratchCost={points.scratchCost}
          description={roomDescription}
          onFridge={goToBilhete}
          onGift={scratch}
        />

        <div className="titulo">
          <h1>Cantinho de {customer.firstName}</h1>
          <p>{lead}</p>
        </div>

        <div className="placar">
          <strong>
            {Math.max(0, Math.min(balance, goal))} de {goal}
          </strong>
          <span>
            {missing === 0
              ? 'estante cheia: troque por um doce'
              : `faltam ${String(missing)} pro doce grátis`}
            <small>os pontos entram quando a compra é paga</small>
          </span>
        </div>

        <div className="acoes">
          {hasDebt ? (
            <button
              className="botao botao-principal botao-largo"
              type="button"
              onClick={() => void copyPix()}
            >
              <Use id="i-pix" />
              <span>{debt.pixCode ? `Pagar ${money(debt.balanceCents)}` : 'Ver o que ficou'}</span>
              {debt.pendingPoints > 0 ? <small>+{debt.pendingPoints} na estante</small> : null}
            </button>
          ) : null}
          <button
            className={`botao ${redeemIsPrimary ? 'botao-principal botao-largo' : 'botao-secundario'}`}
            type="button"
            aria-disabled={missing > 0}
            onClick={redeem}
          >
            <Use id="i-estante" />
            <span>Trocar por doce</span>
            <small>{missing > 0 ? `faltam ${String(missing)}` : `${String(goal)} pontos`}</small>
          </button>
          <button
            className={`botao botao-secundario${redeemIsPrimary ? ' botao-largo' : ''}`}
            type="button"
            aria-disabled={missingScratch > 0}
            onClick={scratch}
          >
            <Use id="i-presente" />
            <span>Raspar a sorte</span>
            <small>
              {missingScratch > 0
                ? `faltam ${String(missingScratch)}`
                : `${String(points.scratchCost)} pontos`}
            </small>
          </button>
        </div>

        {hasDebt ? (
          <Bilhete
            ref={bilheteRef}
            debt={debt}
            showCode={pixFailed}
            onCopy={() => void copyPix()}
          />
        ) : null}

        <Recados history={view.history} />

        <p className="rodape">Este link é só seu. Guarde e não compartilhe.</p>
      </main>
      <div className={`aviso${aviso.visible ? ' mostra' : ''}`} role="status" aria-live="polite">
        {aviso.message}
      </div>
    </>
  );
}
