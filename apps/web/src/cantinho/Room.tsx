import type { KeyboardEvent } from 'react';
import { compactMoney } from './text';

/** A estante tem sempre 2 prateleiras de 5 lugares. */
export const SHELF_SLOTS = 10;

const slots = Array.from({ length: SHELF_SLOTS }, (_, k) => ({
  x: 19 + (k % 5) * 23,
  y: k < 5 ? 71 : 117,
}));

/** Ladrilhos rosa do xadrez do piso (6 x 6, alternados). */
const tiles = Array.from({ length: 36 }, (_, n) => ({ i: Math.floor(n / 6), j: n % 6 })).filter(
  ({ i, j }) => (i + j) % 2 === 1,
);

interface RoomProps {
  storeName: string;
  /** Doces na estante (0 a 10). */
  filled: number;
  /** Pontos além dos 10 lugares. */
  extra: number;
  /** Quantos doces chegaram desde a última visita (caem na estante). */
  arrived: number;
  /** Mostra o "+N" verde (doces novos); na primeira visita a estante só se enche. */
  showPlus: boolean;
  /** Valor em aberto, ou 0 sem dívida (sem bilhete na geladeira). */
  debtCents: number;
  scratchCost: number;
  description: string;
  onFridge: () => void;
  onGift: () => void;
}

function pressable(action: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: action,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        action();
      }
    },
  } as const;
}

/** Nome da loja na plaquinha: diminui para caber, corta só nomes muito longos. */
function plateText(name: string): { text: string; size: number } {
  const text = name.length > 24 ? `${name.slice(0, 23).trimEnd()}…` : name;
  return { text, size: Math.max(6.5, Math.min(11, (11 * 13) / Math.max(text.length, 1))) };
}

/** O quartinho isométrico: a estante é a cartela, a geladeira guarda o bilhete. */
export function Room(props: RoomProps) {
  const { storeName, filled, extra, arrived, debtCents, scratchCost, description } = props;
  const plate = plateText(storeName);
  const firstArrived = filled - Math.min(arrived, filled);

  return (
    <section className="quarto" aria-label="Seu cantinho na loja">
      <svg viewBox="0 0 360 340" role="group" aria-describedby="quarto-desc">
        <desc id="quarto-desc">{description}</desc>
        <defs>
          <g id="motivo">
            <rect
              x="4"
              y="6"
              width="14"
              height="10"
              rx="2.5"
              style={{ fill: 'var(--parede-desenho-forte)' }}
            />
            <path
              d="M4 8.5Q4 6 6.5 6h9Q18 6 18 8.5V10l-2.4 1.4-2.3-1.4-2.3 1.4-2.3-1.4-2.3 1.4L4 10z"
              fill="#fff"
              opacity=".45"
            />
            <circle cx="29" cy="25" r="5" style={{ fill: 'var(--parede-desenho-forte)' }} />
            <path d="M23 27.5h12l-1.6 6.5h-8.8z" fill="#fff" opacity=".85" />
            <path
              d="M23 27.5h12l-1.6 6.5h-8.8z"
              fill="none"
              style={{ stroke: 'var(--parede-desenho-forte)' }}
              strokeWidth="1.3"
            />
            <circle cx="27.5" cy="23" r=".9" fill="#fff" opacity=".8" />
            <circle cx="30.5" cy="24.5" r=".9" fill="#fff" opacity=".8" />
          </g>
          <pattern id="papel-parede" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" style={{ fill: 'var(--parede)' }} />
            <use href="#motivo" />
          </pattern>
          <pattern id="papel-parede-sombra" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" style={{ fill: 'var(--parede-sombra)' }} />
            <use href="#motivo" />
          </pattern>
          <pattern
            id="embrulho"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <rect width="16" height="16" style={{ fill: 'var(--loja)' }} />
            <rect width="6" height="16" fill="#fff" opacity=".35" />
          </pattern>
        </defs>

        {/* sombra do chão */}
        <ellipse cx="180" cy="318" rx="150" ry="16" fill="var(--cacau)" opacity=".10" />

        {/* piso xadrez */}
        <g transform="matrix(1 .5 -1 .5 180 175)">
          <rect x="0" y="0" width="150" height="150" style={{ fill: 'var(--menta)' }} />
          <g style={{ fill: 'var(--rosa)' }}>
            {tiles.map(({ i, j }) => (
              <rect
                key={`${String(i)}-${String(j)}`}
                x={i * 25}
                y={j * 25}
                width="25"
                height="25"
              />
            ))}
          </g>
          <rect
            x="0"
            y="0"
            width="150"
            height="150"
            fill="none"
            stroke="var(--madeira-2)"
            strokeWidth="3"
          />
          <circle cx="92" cy="62" r="36" fill="#fff" opacity=".9" />
          <circle
            cx="92"
            cy="62"
            r="30"
            fill="none"
            style={{ stroke: 'var(--loja)' }}
            strokeWidth="2"
            strokeDasharray="5 5"
            opacity=".6"
          />
        </g>
        <path d="M30 250 L180 325 L330 250 L330 258 L180 333 L30 258 Z" fill="var(--madeira-2)" />

        {/* parede esquerda: plaquinha da loja e a estante */}
        <g transform="matrix(1 -.5 0 1 30 90)">
          <rect x="0" y="0" width="150" height="160" fill="url(#papel-parede-sombra)" />
          <rect x="0" y="148" width="150" height="12" fill="var(--madeira)" />
          <rect x="0" y="-6" width="150" height="6" fill="var(--madeira-2)" />
          <line x1="52" y1="4" x2="75" y2="12" stroke="var(--madeira-2)" strokeWidth="1.5" />
          <line x1="98" y1="4" x2="75" y2="12" stroke="var(--madeira-2)" strokeWidth="1.5" />
          <circle cx="75" cy="4" r="2" fill="var(--madeira-2)" />
          <rect
            x="30"
            y="12"
            width="90"
            height="25"
            rx="6"
            fill="var(--papel)"
            stroke="var(--cacau)"
            strokeWidth="1.5"
          />
          <rect
            x="33"
            y="15"
            width="84"
            height="19"
            rx="4"
            fill="none"
            style={{ stroke: 'var(--loja)' }}
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          <text
            x="75"
            y={25 + plate.size * 0.36}
            textAnchor="middle"
            fontFamily="Caprasimo,serif"
            fontSize={plate.size}
            style={{ fill: 'var(--loja-forte)' }}
            aria-hidden="true"
          >
            {plate.text}
          </text>

          <rect
            x="12"
            y="44"
            width="126"
            height="98"
            rx="4"
            fill="var(--madeira)"
            stroke="var(--madeira-2)"
            strokeWidth="2"
          />
          <rect
            x="17"
            y="49"
            width="116"
            height="40"
            rx="2"
            style={{ fill: 'var(--parede-sombra)' }}
            opacity=".9"
          />
          <rect
            x="17"
            y="95"
            width="116"
            height="40"
            rx="2"
            style={{ fill: 'var(--parede-sombra)' }}
            opacity=".9"
          />
          <rect x="12" y="89" width="126" height="6" fill="var(--madeira-2)" />
          <rect x="12" y="135" width="126" height="7" fill="var(--madeira-2)" />

          <g aria-hidden="true">
            {slots.map((slot, k) => (
              <g key={k} transform={`translate(${String(slot.x)} ${String(slot.y)})`}>
                {k < filled ? (
                  <g
                    className={k >= firstArrived ? 'cai' : undefined}
                    style={
                      k >= firstArrived
                        ? { animationDelay: `${String(0.5 + (k - firstArrived) * 0.14)}s` }
                        : undefined
                    }
                  >
                    <use href="#doce-brownie" width="20" height="15" y="3" />
                  </g>
                ) : (
                  <rect
                    x="1"
                    y="4"
                    width="18"
                    height="13"
                    rx="3"
                    fill="none"
                    stroke="var(--loja-forte)"
                    strokeWidth="1.4"
                    strokeDasharray="3 2.5"
                    opacity=".75"
                  />
                )}
              </g>
            ))}
            {props.showPlus && arrived > 0 && filled > 0 ? (
              <text
                className="mais-um"
                style={{ animationDelay: `${String(1.2 + Math.min(arrived, filled) * 0.14)}s` }}
                x={(slots[filled - 1]?.x ?? 0) + 10}
                y={(slots[filled - 1]?.y ?? 0) - 2}
                textAnchor="middle"
                fontFamily="Nunito,sans-serif"
                fontWeight="800"
                fontSize="10"
                fill="var(--sucesso)"
              >
                {`+${String(arrived)}`}
              </text>
            ) : null}
            {extra > 0 ? (
              <text
                x="146"
                y="157.5"
                textAnchor="end"
                fontFamily="Nunito,sans-serif"
                fontWeight="800"
                fontSize="10"
                fill="var(--cacau)"
              >
                {`+${String(extra)} guardados`}
              </text>
            ) : null}
          </g>
        </g>

        {/* parede direita: janela */}
        <g transform="matrix(1 .5 0 1 180 15)">
          <rect x="0" y="0" width="150" height="160" fill="url(#papel-parede)" />
          <rect x="0" y="148" width="150" height="12" fill="var(--madeira)" />
          <rect x="0" y="-6" width="150" height="6" fill="var(--madeira-2)" />
          <path
            d="M18 100 V56 Q18 32 45 32 Q72 32 72 56 V100 Z"
            fill="#E3F2F8"
            stroke="var(--madeira-2)"
            strokeWidth="4"
          />
          <path d="M45 34 V100 M18 70 H72" stroke="var(--madeira-2)" strokeWidth="3" />
          <path
            d="M26 92 L38 60"
            stroke="#fff"
            strokeWidth="5"
            strokeLinecap="round"
            opacity=".8"
          />
          <rect x="12" y="100" width="66" height="7" rx="2" fill="var(--madeira-2)" />
        </g>
        <line
          x1="180"
          y1="9"
          x2="180"
          y2="175"
          stroke="var(--madeira-2)"
          strokeWidth="2"
          opacity=".5"
        />

        {/* geladeira; com dívida, o bilhete preso nela leva ao bilhete da página */}
        <g
          {...(debtCents > 0 ? pressable(props.onFridge) : {})}
          className={debtCents > 0 ? 'tocavel' : undefined}
          aria-label={
            debtCents > 0 ? `Ver o bilhete: ${compactMoney(debtCents)} em aberto` : undefined
          }
        >
          <path
            d="M280 130 L315 147.5 L293 158.5 L258 141 Z"
            fill="#fff"
            stroke="var(--cacau)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M293 158.5 L315 147.5 L315 242.5 L293 253.5 Z"
            fill="#E4ECEA"
            stroke="var(--cacau)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M258 141 L293 158.5 L293 253.5 L258 236 Z"
            fill="#F7FAF9"
            stroke="var(--cacau)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <g transform="matrix(1 .5 0 1 258 141)">
            <line x1="0" y1="34" x2="35" y2="34" stroke="var(--cacau)" strokeWidth="1.5" />
            <rect x="31" y="12" width="2.5" height="16" rx="1.2" fill="var(--madeira-2)" />
            <rect x="31" y="40" width="2.5" height="16" rx="1.2" fill="var(--madeira-2)" />
            {debtCents > 0 ? (
              <g aria-hidden="true">
                <rect className="contorno-foco" x="1" y="40" width="28" height="32" rx="2" />
                <rect
                  x="2"
                  y="42"
                  width="26"
                  height="28"
                  rx="1.5"
                  fill="var(--papel)"
                  stroke="var(--cacau)"
                  strokeWidth="1"
                />
                <circle
                  cx="15"
                  cy="43"
                  r="3"
                  style={{ fill: 'var(--loja)' }}
                  stroke="var(--cacau)"
                  strokeWidth=".8"
                />
                <text
                  x="15"
                  y="54"
                  textAnchor="middle"
                  fontFamily="Nunito,sans-serif"
                  fontWeight="800"
                  fontSize="6"
                  fill="var(--cacau-2)"
                >
                  devo
                </text>
                <text
                  x="15"
                  y="63.5"
                  textAnchor="middle"
                  fontFamily="Caprasimo,serif"
                  fontSize={compactMoney(debtCents).length > 5 ? 6.2 : 8.5}
                  fill="var(--cacau)"
                >
                  {compactMoney(debtCents)}
                </text>
              </g>
            ) : null}
          </g>
        </g>

        {/* caixa de presente da raspadinha */}
        <g
          {...pressable(props.onGift)}
          className="tocavel"
          aria-label={`Raspar a sorte por ${String(scratchCost)} pontos`}
        >
          <path
            className="contorno-foco"
            d="M184 216 L220 198 L256 216 L256 256 L220 274 L184 256 Z"
            strokeDasharray="4 4"
          />
          <path
            d="M190 250 L220 265 L250 250 L250 222 L220 237 L190 222 Z"
            fill="url(#embrulho)"
            stroke="var(--cacau)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M220 237 L220 265" stroke="var(--cacau)" strokeWidth="1.5" />
          <path d="M190 222 L220 237 L220 265 L190 250 Z" fill="var(--cacau)" opacity=".12" />
          <path d="M205 229.5 V257.5 M235 229.5 V257.5" stroke="#fff" strokeWidth="5" />
          <g className="presente-tampa">
            <path
              d="M186 218 L220 201 L254 218 L220 235 Z"
              style={{ fill: 'var(--loja-forte)' }}
              stroke="var(--cacau)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M186 218 L220 235 L254 218 L254 223 L220 240 L186 223 Z"
              style={{ fill: 'var(--loja-forte)' }}
              stroke="var(--cacau)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M203 209.5 L237 226.5 M237 209.5 L203 226.5" stroke="#fff" strokeWidth="5" />
            <path
              d="M220 218 C208 204 200 210 206 215 C210 219 220 218 220 218 C220 218 230 219 234 215 C240 210 232 204 220 218 Z"
              fill="#fff"
              stroke="var(--cacau)"
              strokeWidth="1.5"
            />
            <circle cx="220" cy="217" r="3" fill="#fff" stroke="var(--cacau)" strokeWidth="1.5" />
          </g>
          <g transform="translate(246 258) rotate(-6)" aria-hidden="true">
            <path
              d="M0 0 H30 Q34 0 34 4 V16 Q34 20 30 20 H0 L-7 10 Z"
              fill="var(--papel)"
              stroke="var(--cacau)"
              strokeWidth="1.5"
            />
            <circle cx="-1" cy="10" r="1.8" fill="var(--cacau)" />
            <text
              x="16"
              y="14.5"
              textAnchor="middle"
              fontFamily="Nunito,sans-serif"
              fontWeight="800"
              fontSize="11"
              fill="var(--cacau)"
            >
              {`${String(scratchCost)} pts`}
            </text>
          </g>
        </g>

        {/* vasinho */}
        <g transform="translate(70 252)" aria-hidden="true">
          <path
            d="M-12 -2 L12 -2 L9 18 L-9 18 Z"
            fill="var(--madeira-2)"
            stroke="var(--cacau)"
            strokeWidth="1.5"
          />
          <path
            d="M0 -2 C-2 -16 -14 -22 -16 -30 C-6 -28 0 -18 0 -2 M0 -2 C2 -18 10 -26 18 -28 C16 -18 6 -12 0 -2 M0 -2 C0 -14 -2 -28 4 -38 C8 -26 4 -12 0 -2"
            style={{ fill: 'var(--sucesso)' }}
            stroke="var(--cacau)"
            strokeWidth="1.2"
          />
        </g>
      </svg>
    </section>
  );
}
