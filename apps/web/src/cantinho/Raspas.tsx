import type { ScratchFormat } from '@cvd/core';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Doce, doceOf } from './Doce';

/** Toques de raspagem até a casinha se limpar sozinha (DESIGN.md › Casinhas de Raspar). */
const STROKES_TO_CLEAR = 14;

type Conteudo = { kind: 'doce'; name: string } | { kind: 'vazio' };

/**
 * O que fica debaixo de cada casinha. O resultado já veio do servidor: aqui só se
 * decide a encenação. A posição do doce sai do id da jogada, para não mudar a cada
 * desenho (e não depende de nada que o cliente controle).
 */
function conteudos(
  format: ScratchFormat,
  won: boolean,
  seed: string,
  prizeNames: readonly string[],
): Conteudo[] {
  const n = parseInt(seed.replace(/[^0-9a-f]/gi, '').slice(0, 6), 16) || 0;
  // O doce da encenação é um dos prêmios da loja (o cliente escolhe depois).
  const doce: Conteudo = { kind: 'doce', name: prizeNames[n % prizeNames.length] ?? 'Brigadeiro' };
  if (format === 'five_spots') {
    const spot = n % 5;
    return Array.from({ length: 5 }, (_, i) => (won && i === spot ? doce : { kind: 'vazio' }));
  }
  if (won) return [doce, doce, doce];
  // Quase: dois iguais e um de desenho diferente, em lugar variado.
  const drawing = doceOf(doce.name).id;
  const otherName =
    [...prizeNames, 'Brownie', 'Bolo de pote', 'Brigadeiro'].find(
      (name) => doceOf(name).id !== drawing,
    ) ?? 'Brigadeiro';
  const odd = n % 3;
  return [0, 1, 2].map((i) => (i === odd ? { kind: 'doce', name: otherName } : doce));
}

interface CasaProps {
  conteudo: Conteudo;
  /** É o doce do prêmio (assenta com mola ao aparecer). */
  premiada: boolean;
  label: string;
  cleared: boolean;
  onCleared: () => void;
}

/** Uma casinha: o resultado por baixo e um canvas pintado de papel de presente por cima. */
function Casa({ conteudo, premiada, label, cleared, onCleared }: CasaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef(0);
  const drawing = useRef(false);
  const clearedRef = useRef(cleared);
  useEffect(() => {
    clearedRef.current = cleared;
  }, [cleared]);

  // Pinta a cobertura com a cor crua da loja, listras brancas e o círculo no centro.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const paint = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      const loja = getComputedStyle(document.documentElement).getPropertyValue('--loja').trim();
      ctx.fillStyle = loja || '#D6336C';
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(-Math.PI / 5);
      ctx.fillStyle = 'rgba(255,255,255,.32)';
      for (let x = -width * 1.5; x < width * 1.5; x += 14) ctx.fillRect(x, -height, 6, height * 2);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.12, 0, Math.PI * 2);
      ctx.fill();
    };
    const frame = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  const scratch = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!drawing.current || clearedRef.current || !canvas || !ctx) return;
    const box = canvas.getBoundingClientRect();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(
      event.clientX - box.left,
      event.clientY - box.top,
      Math.max(box.width * 0.16, 9),
      0,
      Math.PI * 2,
    );
    ctx.fill();
    strokes.current += 1;
    if (strokes.current > STROKES_TO_CLEAR) {
      clearedRef.current = true;
      onCleared();
    }
  };

  return (
    <div
      className={`casa${cleared ? ' limpa' : ''}${premiada ? ' premiada' : ''}`}
      role="img"
      aria-label={label}
    >
      {conteudo.kind === 'doce' ? (
        <Doce name={conteudo.name} size={40} />
      ) : (
        <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
          <circle
            cx="20"
            cy="20"
            r="8"
            fill="none"
            stroke="var(--madeira-2)"
            strokeWidth="2.5"
            strokeDasharray="4 4"
          />
        </svg>
      )}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        onPointerDown={(event) => {
          drawing.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          scratch(event);
        }}
        onPointerMove={scratch}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
    </div>
  );
}

interface RaspasProps {
  format: ScratchFormat;
  won: boolean;
  /** Id da jogada: fixa a encenação. */
  seed: string;
  /** Nomes dos produtos-prêmio (o doce desenhado sai deles). */
  prizeNames: readonly string[];
  /** "Revelar tudo" já foi tocado (ou todas as casinhas foram raspadas). */
  revealed: boolean;
  /** Todas as casinhas foram raspadas com o dedo. */
  onRevealed: () => void;
}

/** As casinhas de raspar de uma jogada (5 casinhas ou 3 iguais). */
export function Raspas({ format, won, seed, prizeNames, revealed, onRevealed }: RaspasProps) {
  const items = conteudos(format, won, seed, prizeNames);
  const [cleared, setCleared] = useState<readonly number[]>([]);

  return (
    <div className={`raspas ${format === 'five_spots' ? 'cinco' : 'tres'}`}>
      {items.map((conteudo, index) => {
        const isCleared = revealed || cleared.includes(index);
        const label = isCleared
          ? conteudo.kind === 'doce'
            ? `Casinha ${String(index + 1)}: ${conteudo.name.toLowerCase()}`
            : `Casinha ${String(index + 1)}: vazia`
          : `Casinha ${String(index + 1)}: coberta`;
        return (
          <Casa
            key={index}
            conteudo={conteudo}
            premiada={won && conteudo.kind === 'doce'}
            label={label}
            cleared={isCleared}
            onCleared={() => {
              const next = cleared.includes(index) ? cleared : [...cleared, index];
              setCleared(next);
              if (!revealed && next.length === items.length) onRevealed();
            }}
          />
        );
      })}
    </div>
  );
}
