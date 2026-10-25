interface RandomSource {
  getRandomValues(array: Uint8Array): Uint8Array;
}

/** PINs fáceis de adivinhar, que o core nunca sugere. */
function isTrivial(pin: string): boolean {
  if (/^(\d)\1{3}$/.test(pin)) return true;
  return '0123456789'.includes(pin) || '9876543210'.includes(pin);
}

function randomDigit(): number {
  const random = (globalThis as { crypto?: Partial<RandomSource> }).crypto;
  if (random?.getRandomValues) {
    const byte = new Uint8Array(1);
    // Descarta 250–255 para os dígitos saírem equiprováveis.
    do random.getRandomValues(byte);
    while ((byte[0] ?? 255) >= 250);
    return (byte[0] ?? 0) % 10;
  }
  // Sem Web Crypto (alguns runtimes RN): o PIN é só uma sugestão editável.
  return Math.floor(Math.random() * 10);
}

/** Sugere um PIN de 4 dígitos aleatório, evitando sequências e dígitos repetidos. */
export function suggestPin(): string {
  for (;;) {
    const pin = Array.from({ length: 4 }, randomDigit).join('');
    if (!isTrivial(pin)) return pin;
  }
}
