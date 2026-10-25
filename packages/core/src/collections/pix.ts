import { CoreError, type FieldErrors } from '../errors';

/** O que o Pix copia-e-cola estático precisa: a chave e o nome/cidade do recebedor. */
export interface PixInput {
  /** Chave Pix da loja, como cadastrada (telefone com +55, e-mail, CPF/CNPJ, aleatória). */
  key: string;
  /** Nome do recebedor (a loja). Vira maiúsculas sem acento, até 25 caracteres. */
  name: string;
  /** Cidade do recebedor. Vira maiúsculas sem acento, até 15 caracteres. */
  city: string;
  /** Valor em centavos inteiros; omitido, quem paga digita o valor. */
  amountCents?: number;
  /** Identificador da cobrança: só letras e números, até 25. Padrão `***` (não usado). */
  txid?: string;
}

export type PixField = 'key' | 'name' | 'city' | 'amountCents';

const MAX_NAME = 25;
const MAX_CITY = 15;
const MAX_TXID = 25;
/** Chave + template da conta (`br.gov.bcb.pix`) têm que caber em 99 caracteres. */
const MAX_KEY = 77;
/** O campo de valor do BR Code tem até 13 caracteres ("9999999999.99"). */
const MAX_AMOUNT_CENTS = 999_999_999_999;

/** CRC-16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF) em 4 hex maiúsculos. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function field(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

/** Sem acento, só letras/números/espaço, maiúsculas, cortado em `max`. */
function normalizeText(text: string, max: number): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim();
}

/**
 * Gera o Pix copia-e-cola estático (BR Code / EMV MPM, Manual de Padrões do Pix
 * do BCB) com chave, nome, cidade e valor, incluindo o CRC16. Puro e local.
 * Erros: INVALID_INPUT com mensagem por campo.
 */
export function buildPixCopyAndPaste(input: PixInput): string {
  const key = input.key.trim();
  const name = normalizeText(input.name, MAX_NAME);
  const city = normalizeText(input.city, MAX_CITY);
  const txid = (input.txid ?? '***').trim();
  const fieldErrors: FieldErrors<PixField> = {};

  if (key === '') fieldErrors.key = 'Informe a chave Pix da loja.';
  else if (key.length > MAX_KEY) fieldErrors.key = 'A chave Pix é grande demais.';
  if (name === '') fieldErrors.name = 'Informe o nome da loja.';
  if (city === '') fieldErrors.city = 'Informe a cidade da loja.';
  if (
    input.amountCents !== undefined &&
    (!Number.isInteger(input.amountCents) ||
      input.amountCents <= 0 ||
      input.amountCents > MAX_AMOUNT_CENTS)
  ) {
    fieldErrors.amountCents = 'Informe um valor maior que zero.';
  }
  if (txid !== '***' && !(/^[A-Za-z0-9]+$/.test(txid) && txid.length <= MAX_TXID)) {
    throw new CoreError('INVALID_INPUT', { message: 'Identificador do Pix inválido.' });
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new CoreError<PixField>('INVALID_INPUT', { fieldErrors });
  }

  const payload =
    field('00', '01') +
    field('26', field('00', 'br.gov.bcb.pix') + field('01', key)) +
    field('52', '0000') +
    field('53', '986') +
    (input.amountCents === undefined ? '' : field('54', (input.amountCents / 100).toFixed(2))) +
    field('58', 'BR') +
    field('59', name) +
    field('60', city) +
    field('62', field('05', txid)) +
    '6304';
  return payload + crc16(payload);
}
