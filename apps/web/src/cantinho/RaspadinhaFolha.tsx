import {
  isCoreError,
  SCRATCH_FORMATS,
  type CustomerView,
  type CustomerViewCoupon,
  type ScratchFormat,
  type ScratchPlayResult,
} from '@cvd/core';
import { useRef, useState } from 'react';
import { getCore } from '../core';
import { Doce } from './Doce';
import { Folha } from './Folha';
import { PinField } from './PinField';
import { Raspas } from './Raspas';
import { premioText, pontosText } from './text';

interface RaspadinhaFolhaProps {
  token: string;
  view: CustomerView;
  /** Abre direto na escolha do prêmio de uma jogada ganha antes (página fechada no meio). */
  pendingPlayId?: string | undefined;
  onClose: () => void;
  /** Os pontos ou os prêmios mudaram no servidor: a página relê a visão. */
  onChanged: () => void;
}

const formatos: Record<ScratchFormat, { title: string; hint: string }> = {
  five_spots: { title: '5 casinhas', hint: 'Um doce escondido em alguma' },
  match_three: { title: '3 iguais', hint: 'Três doces iguais ganham' },
};

/** Miniatura do papel de presente de cada formato (usa o padrão #embrulho do quarto). */
function Miniatura({ format }: { format: ScratchFormat }) {
  return (
    <svg viewBox="0 0 100 30" aria-hidden="true" focusable="false">
      <g fill="url(#embrulho)" stroke="var(--cacau)" strokeWidth="1.2">
        {format === 'five_spots' ? (
          [12, 31, 50, 69, 88].map((cx) => <circle key={cx} cx={cx} cy="15" r="9" />)
        ) : (
          <>
            <rect x="8" y="2" width="26" height="26" rx="5" />
            <rect x="37" y="2" width="26" height="26" rx="5" />
            <rect x="66" y="2" width="26" height="26" rx="5" />
          </>
        )}
      </g>
    </svg>
  );
}

type Step =
  | { kind: 'formato' }
  | { kind: 'raspar'; result: ScratchPlayResult; revealed: boolean }
  | { kind: 'pronto'; coupon: CustomerViewCoupon };

/**
 * A folha da raspadinha (DESIGN.md › Folha): escolher o jeito de raspar, digitar o
 * PIN e usar os pontos. O servidor sorteia e grava a jogada antes de responder; as
 * casinhas só encenam o resultado que já veio. Ganhou: escolhe o doce e vira cupom.
 */
export function RaspadinhaFolha({
  token,
  view,
  pendingPlayId,
  onClose,
  onChanged,
}: RaspadinhaFolhaProps) {
  const cost = view.points.scratchCost;
  const { prizes } = view;
  const [step, setStep] = useState<Step>({ kind: 'formato' });
  const [format, setFormat] = useState<ScratchFormat>('five_spots');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<string | null>(() =>
    prizes.length === 1 ? (prizes[0]?.id ?? null) : null,
  );
  // PIN já conferido pelo servidor nesta folha: a escolha do prêmio não pede de novo.
  const [pinAccepted, setPinAccepted] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const changed = useRef(false);

  const close = () => {
    // A jogada já mudou o saldo; relê a visão ao fechar se a revelação não releu.
    if (step.kind === 'raspar' && !changed.current) onChanged();
    onClose();
  };

  const pinProblem = (error: unknown): boolean => {
    if (isCoreError(error) && error.fieldErrors.pin) {
      setPinError(error.fieldErrors.pin);
      setPinAccepted(false);
      setPin('');
      pinRef.current?.focus();
      return true;
    }
    return false;
  };

  const checkPin = (): boolean => {
    if (/^\d{4}$/.test(pin)) return true;
    setPinError('Digite os 4 números do seu PIN.');
    pinRef.current?.focus();
    return false;
  };

  const play = async () => {
    if (sending.current) return;
    setFormError(null);
    if (!checkPin()) return;
    sending.current = true;
    setBusy(true);
    try {
      const result = await getCore().customerPage.playScratch({ token, pin, format });
      setPinAccepted(true);
      setStep({ kind: 'raspar', result, revealed: false });
    } catch (error) {
      if (pinProblem(error)) return;
      if (isCoreError(error) && error.code === 'INSUFFICIENT_POINTS') {
        setFormError('Seus pontos mudaram e não dão mais pra raspar.');
        onChanged();
      } else {
        setFormError(isCoreError(error) ? error.message : 'Algo deu errado. Tente de novo.');
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const claim = async (playId: string) => {
    if (sending.current) return;
    setFormError(null);
    if (!chosen) {
      setFormError('Escolha o doce que você quer.');
      return;
    }
    if (!checkPin()) return;
    sending.current = true;
    setBusy(true);
    try {
      const { coupon } = await getCore().customerPage.claimScratchPrize({
        token,
        pin,
        playId,
        productId: chosen,
      });
      setStep({ kind: 'pronto', coupon });
      onChanged();
    } catch (error) {
      if (pinProblem(error)) return;
      if (isCoreError(error) && error.code === 'PRIZE_NOT_AVAILABLE') {
        setChosen(null);
        setFormError(error.message);
        onChanged();
      } else {
        setFormError(isCoreError(error) ? error.message : 'Algo deu errado. Tente de novo.');
        if (isCoreError(error) && error.code === 'PRIZE_ALREADY_CLAIMED') onChanged();
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const errorLine = (
    <p className="erro erro-folha" role="alert">
      {formError ?? ''}
    </p>
  );

  /** Lista dos doces de prêmio + (se preciso) PIN + botão de confirmar. */
  const prizeForm = (playId: string) => (
    <form
      className="premio-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void claim(playId);
      }}
    >
      <fieldset className="escolhas">
        <legend className="sr-only">Doce do prêmio</legend>
        {prizes.map((prize) => (
          <label key={prize.id} className="escolha">
            <input
              type="radio"
              name="premio"
              value={prize.id}
              checked={chosen === prize.id}
              onChange={() => {
                setChosen(prize.id);
                setFormError(null);
              }}
            />
            <Doce name={prize.name} size={36} />
            <span>{prize.name}</span>
          </label>
        ))}
      </fieldset>
      {pinAccepted ? null : (
        <PinField
          ref={pinRef}
          value={pin}
          error={pinError}
          onChange={(next) => {
            setPin(next);
            setPinError(null);
          }}
        />
      )}
      {errorLine}
      <button className="botao botao-principal" type="submit" aria-disabled={busy}>
        <span>{busy ? 'Guardando…' : 'Quero esse'}</span>
      </button>
    </form>
  );

  if (step.kind === 'pronto') {
    return (
      <Folha titleId="t-raspar" title="Prontinho!" onClose={close}>
        <div className="etapa" aria-live="polite">
          <div className="cupom">
            <Doce name={step.coupon.productName} size={52} />
            <div>
              <strong>{premioText(step.coupon.productName)} esperando você</strong>
              <span>Mostre esta tela na próxima compra.</span>
            </div>
          </div>
          <button className="botao botao-principal pronto" type="button" onClick={close}>
            <span>Pronto</span>
          </button>
        </div>
      </Folha>
    );
  }

  if (pendingPlayId) {
    return (
      <Folha
        titleId="t-raspar"
        title="Escolha seu doce"
        sub="Você ganhou na raspadinha. Qual vai querer?"
        onClose={close}
      >
        <div className="etapa">{prizeForm(pendingPlayId)}</div>
      </Folha>
    );
  }

  if (step.kind === 'raspar') {
    const { result, revealed } = step;
    const left = result.balance;
    return (
      <Folha titleId="t-raspar" title="Raspar a sorte" onClose={close}>
        <div className="etapa">
          <Raspas
            format={result.play.format}
            won={result.play.won}
            seed={result.play.id}
            revealed={revealed}
            onRevealed={() => {
              setStep({ kind: 'raspar', result, revealed: true });
              changed.current = true;
              onChanged();
            }}
          />
          <div className="resultado" aria-live="polite">
            {!revealed ? (
              <p>Passe o dedo pra raspar.</p>
            ) : result.play.won ? (
              <>
                <h3>Você ganhou um doce!</h3>
                <p>Escolha qual vai querer:</p>
              </>
            ) : (
              <>
                <h3>Não foi dessa vez</h3>
                <p>
                  {left > 0
                    ? `Seus outros ${pontosText(left)} continuam na estante.`
                    : 'Cada compra paga traz doces de volta pra estante.'}
                </p>
              </>
            )}
          </div>
          {!revealed ? (
            <button
              className="botao botao-secundario"
              type="button"
              onClick={() => {
                setStep({ kind: 'raspar', result, revealed: true });
                changed.current = true;
                onChanged();
              }}
            >
              <span>Revelar tudo</span>
            </button>
          ) : result.play.won ? (
            prizeForm(result.play.id)
          ) : (
            <button className="botao botao-secundario" type="button" onClick={close}>
              <span>Fechar</span>
            </button>
          )}
        </div>
      </Folha>
    );
  }

  return (
    <Folha
      titleId="t-raspar"
      title="Raspar a sorte"
      sub={`Custa ${pontosText(cost)}. Se ganhar, você escolhe o doce.`}
      onClose={close}
    >
      <form
        className="etapa"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void play();
        }}
      >
        <fieldset className="formatos">
          <legend className="sr-only">Jeito de raspar</legend>
          {SCRATCH_FORMATS.map((option) => (
            <label key={option} className="formato">
              <input
                type="radio"
                name="formato"
                value={option}
                checked={format === option}
                onChange={() => {
                  setFormat(option);
                }}
              />
              <Miniatura format={option} />
              <strong>{formatos[option].title}</strong>
              <span>{formatos[option].hint}</span>
            </label>
          ))}
        </fieldset>
        <p className="igual">Os dois jeitos têm a mesma chance.</p>

        <PinField
          ref={pinRef}
          value={pin}
          error={pinError}
          onChange={(next) => {
            setPin(next);
            setPinError(null);
          }}
        />

        {errorLine}

        <button className="botao botao-principal" type="submit" aria-disabled={busy}>
          <span>{busy ? 'Sorteando…' : `Usar ${String(cost)} pontos e raspar`}</span>
        </button>
      </form>
    </Folha>
  );
}
