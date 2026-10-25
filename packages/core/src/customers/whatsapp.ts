/**
 * DDDs válidos no Brasil (ANATEL). O banco só confere o formato; a lista fica aqui.
 */
const validDdds = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Normaliza um telefone brasileiro digitado de qualquer jeito para 55 + DDD + número,
 * só dígitos, como o wa.me espera. Aceita +55, 0 de tronco, código de operadora e
 * celular antigo sem o nono dígito. Devolve null se não for um número válido.
 */
export function normalizeWhatsApp(input: string): string | null {
  let digits = input.replace(/\D/g, '');

  if (digits.startsWith('00')) digits = digits.slice(2);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    // 0 de tronco (0 31 ...) ou 0 + operadora (0 15 31 ...).
    digits = digits.length >= 13 ? digits.slice(3) : digits.slice(1);
  }

  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = digits.slice(0, 2);
  let local = digits.slice(2);
  if (!validDdds.has(Number(ddd))) return null;

  if (local.length === 9) {
    if (!local.startsWith('9')) return null;
  } else if (/^[6-9]/.test(local)) {
    // Celular no formato anterior ao nono dígito.
    local = `9${local}`;
  } else if (!/^[2-5]/.test(local)) {
    return null;
  }
  return `55${ddd}${local}`;
}

/** Telefone normalizado para exibição: (31) 99876-5432. */
export function formatWhatsApp(whatsapp: string): string {
  const national = whatsapp.startsWith('55') ? whatsapp.slice(2) : whatsapp;
  const ddd = national.slice(0, 2);
  const local = national.slice(2);
  const split = local.length - 4;
  return `(${ddd}) ${local.slice(0, split)}-${local.slice(split)}`;
}
