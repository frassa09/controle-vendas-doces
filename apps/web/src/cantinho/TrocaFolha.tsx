import { isCoreError, type CustomerView, type RedeemRewardResult } from '@cvd/core';
import { useRef, useState } from 'react';
import { getCore } from '../core';
import { Doce } from './Doce';
import { Folha } from './Folha';
import { PinField } from './PinField';
import { premioText, pontosText } from './text';

interface TrocaFolhaProps {
  token: string;
  view: CustomerView;
  onClose: () => void;
  /** Os pontos ou os prêmios mudaram no servidor: a página relê a visão. */
  onChanged: () => void;
}

/** A folha de troca: escolher o doce, digitar o PIN e trocar os pontos por um cupom. */
export function TrocaFolha({ token, view, onClose, onChanged }: TrocaFolhaProps) {
  const { prizes } = view;
  const cost = view.points.redeemCost;
  const [chosen, setChosen] = useState<string | null>(() =>
    prizes.length === 1 ? (prizes[0]?.id ?? null) : null,
  );
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<RedeemRewardResult | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const sending = useRef(false);

  const submit = async () => {
    if (sending.current) return;
    setFormError(null);
    if (!chosen) {
      setFormError('Escolha o doce que você quer.');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setPinError('Digite os 4 números do seu PIN.');
      pinRef.current?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);
    try {
      const result = await getCore().customerPage.redeemReward({ token, pin, productId: chosen });
      setDone(result);
      onChanged();
    } catch (error) {
      if (!isCoreError(error)) {
        setFormError('Algo deu errado. Tente de novo.');
      } else if (error.fieldErrors.pin) {
        setPinError(error.fieldErrors.pin);
        setPin('');
        pinRef.current?.focus();
      } else if (error.code === 'PRIZE_NOT_AVAILABLE') {
        setChosen(null);
        setFormError(error.message);
        onChanged();
      } else if (error.code === 'INSUFFICIENT_POINTS') {
        setFormError('Seus pontos mudaram e não dão mais pra essa troca.');
        onChanged();
      } else {
        setFormError(error.message);
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Folha titleId="t-troca" title="Prontinho!" onClose={onClose}>
        <div className="etapa" aria-live="polite">
          <div className="cupom">
            <Doce name={done.coupon.productName} size={52} />
            <div>
              <strong>{premioText(done.coupon.productName)} esperando você</strong>
              <span>Mostre esta tela na próxima compra.</span>
            </div>
          </div>
          <p className="folha-nota">
            {done.balance > 0
              ? `Ficaram ${pontosText(done.balance)} na sua estante.`
              : 'Sua estante recomeça agora. Cada compra paga traz doces de volta.'}
          </p>
          <button className="botao botao-principal" type="button" onClick={onClose}>
            <span>Pronto</span>
          </button>
        </div>
      </Folha>
    );
  }

  return (
    <Folha
      titleId="t-troca"
      title="Trocar por um doce"
      sub={`Custa ${pontosText(cost)}. Escolha o seu:`}
      onClose={onClose}
    >
      <form
        className="etapa"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
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

        <PinField
          ref={pinRef}
          value={pin}
          error={pinError}
          onChange={(next) => {
            setPin(next);
            setPinError(null);
          }}
        />

        <p className="erro erro-folha" role="alert">
          {formError ?? ''}
        </p>

        <button className="botao botao-principal" type="submit" aria-disabled={busy}>
          <span>{busy ? 'Trocando…' : `Usar ${String(cost)} pontos e trocar`}</span>
        </button>
      </form>
    </Folha>
  );
}
