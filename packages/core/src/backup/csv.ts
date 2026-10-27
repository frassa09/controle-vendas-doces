/** Valor aceito numa célula de CSV. null e undefined viram célula vazia. */
export type CsvValue = string | number | boolean | null | undefined;

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
  const needsQuotes = /[",\r\n]/.test(text) || text !== text.trim();
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Monta um CSV (RFC 4180): cabeçalho, separador vírgula, linhas terminadas em \r\n e
 * aspas só quando a célula tem vírgula, aspas, quebra de linha ou espaço nas pontas.
 * Cada linha traz os valores na ordem do cabeçalho.
 */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  return [header, ...rows].map((row) => row.map(cell).join(',') + '\r\n').join('');
}
