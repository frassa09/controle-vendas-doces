/** Os doces desenhados que existem (Symbols). Produto sem desenho próprio vira brigadeiro. */
const doces = [
  { pattern: /brownie/i, id: 'doce-brownie', viewBox: '0 0 40 30' },
  { pattern: /pote/i, id: 'doce-pote', viewBox: '0 0 40 40' },
] as const;

function doceOf(name: string): { id: string; viewBox: string } {
  return (
    doces.find((doce) => doce.pattern.test(name)) ?? {
      id: 'doce-brigadeiro',
      viewBox: '0 0 40 40',
    }
  );
}

/** A ilustração do doce pelo nome do produto (prêmios e cupons). */
export function Doce({ name, size }: { name: string; size: number }) {
  const doce = doceOf(name);
  return (
    <svg viewBox={doce.viewBox} width={size} height={size} aria-hidden="true" focusable="false">
      <use href={`#${doce.id}`} />
    </svg>
  );
}
