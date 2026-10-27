/** Um arquivo CSV do backup (uma entidade). */
export interface BackupFile {
  /** Nome do arquivo, ex.: "vendas.csv". */
  name: BackupFileName;
  /** Conteúdo em UTF-8, com cabeçalho. */
  csv: string;
}

export interface Backup {
  /** Quando o backup foi gerado, ISO. */
  createdAt: string;
  /** Um CSV por entidade, sempre nesta ordem: BACKUP_FILE_NAMES. */
  files: BackupFile[];
}

/** Os arquivos do backup, na ordem em que aparecem. */
export const BACKUP_FILE_NAMES = [
  'loja.csv',
  'membros.csv',
  'produtos.csv',
  'clientes.csv',
  'vendas.csv',
  'itens.csv',
  'itens-alterados.csv',
  'pagamentos.csv',
  'pontos.csv',
  'cupons.csv',
  'raspadinhas.csv',
  'cobrancas.csv',
] as const;

export type BackupFileName = (typeof BACKUP_FILE_NAMES)[number];
