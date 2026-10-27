import type { DbClient } from '../db/client';
import { fromDbError } from '../db/errors';
import { requireStoreId } from '../db/session';
import type { Backup, BackupFile, BackupFileName } from './backup';
import { toCsv, type CsvValue } from './csv';

/** Tamanho de página: o PostgREST devolve no máximo 1000 linhas por pedido. */
const PAGE = 1000;

type Row = Record<string, CsvValue>;

const STORE_COLUMNS = [
  'id',
  'name',
  'pix_key',
  'city',
  'brand_color',
  'welcome_text',
  'collection_template',
  'points_validity_days',
  'redeem_cost',
  'scratch_cost',
  'scratch_win_percent',
  'created_at',
];

interface TableSpec {
  file: BackupFileName;
  table:
    | 'products'
    | 'customers'
    | 'sales'
    | 'sale_items'
    | 'sale_item_revisions'
    | 'payments'
    | 'points_ledger'
    | 'coupons'
    | 'scratch_plays'
    | 'collections';
  columns: string[];
  /** Ordem estável para paginar. Padrão: created_at, id. */
  order?: string[];
}

/**
 * Colunas de cada tabela que entram no backup. O PIN e o token do link do cliente
 * ficam de fora por segurança; o logo da loja (imagem) também.
 */
const TABLES: TableSpec[] = [
  {
    file: 'produtos.csv',
    table: 'products',
    columns: [
      'id',
      'name',
      'price_cents',
      'points',
      'is_combo',
      'is_active',
      'can_be_prize',
      'created_at',
    ],
  },
  {
    file: 'clientes.csv',
    table: 'customers',
    columns: [
      'id',
      'name',
      'whatsapp',
      'reference',
      'notes',
      'consented',
      'consent_at',
      'created_at',
      'updated_at',
    ],
  },
  {
    file: 'vendas.csv',
    table: 'sales',
    columns: [
      'id',
      'customer_id',
      'status',
      'recorded_by',
      'created_at',
      'edited_by',
      'edited_at',
      'cancelled_by',
      'cancelled_at',
    ],
  },
  {
    file: 'itens.csv',
    table: 'sale_items',
    columns: [
      'id',
      'sale_id',
      'position',
      'product_id',
      'product_name',
      'quantity',
      'unit_price_cents',
      'points',
    ],
    order: ['sale_id', 'position', 'id'],
  },
  {
    file: 'itens-alterados.csv',
    table: 'sale_item_revisions',
    columns: [
      'id',
      'sale_id',
      'revision',
      'position',
      'product_id',
      'product_name',
      'quantity',
      'unit_price_cents',
      'points',
      'replaced_by',
      'replaced_at',
    ],
    order: ['sale_id', 'revision', 'position', 'id'],
  },
  {
    file: 'pagamentos.csv',
    table: 'payments',
    columns: [
      'id',
      'sale_id',
      'customer_id',
      'amount_cents',
      'method',
      'status',
      'recorded_by',
      'created_at',
      'cancelled_by',
      'cancelled_at',
    ],
  },
  {
    file: 'pontos.csv',
    table: 'points_ledger',
    columns: ['id', 'customer_id', 'kind', 'points', 'sale_id', 'scratch_play_id', 'created_at'],
  },
  {
    file: 'cupons.csv',
    table: 'coupons',
    columns: [
      'id',
      'customer_id',
      'origin',
      'product_id',
      'product_name',
      'scratch_play_id',
      'status',
      'created_at',
      'delivered_by',
      'delivered_at',
    ],
  },
  {
    file: 'raspadinhas.csv',
    table: 'scratch_plays',
    columns: ['id', 'customer_id', 'format', 'cost', 'win_percent', 'won', 'created_at'],
  },
  {
    file: 'cobrancas.csv',
    table: 'collections',
    columns: ['id', 'customer_id', 'amount_cents', 'recorded_by', 'created_at'],
  },
];

function toFile(name: BackupFileName, columns: string[], rows: Row[]): BackupFile {
  return {
    name,
    csv: toCsv(
      columns,
      rows.map((row) => columns.map((c) => row[c])),
    ),
  };
}

/** Todas as linhas visíveis da tabela (o RLS limita à loja do membro), página a página. */
async function readAll(db: DbClient, spec: TableSpec): Promise<Row[]> {
  const rows: Row[] = [];
  const order = spec.order ?? ['created_at', 'id'];
  for (let from = 0; ; from += PAGE) {
    let query = db.from(spec.table).select(spec.columns.join(','));
    for (const column of order) query = query.order(column, { ascending: true });
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw fromDbError(error);
    const page = data as unknown as Row[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/**
 * Backup completo da loja de quem está logado, um CSV por entidade, com vendas e
 * pagamentos cancelados. Lê só pelo RLS, então nada de outra loja entra.
 * Erros: NOT_AUTHENTICATED, FORBIDDEN (sem loja).
 */
export async function exportBackup(db: DbClient): Promise<Backup> {
  const storeId = await requireStoreId(db);
  const createdAt = new Date().toISOString();

  const [store, members, tables] = await Promise.all([
    db.from('stores').select(STORE_COLUMNS.join(',')).eq('id', storeId).single(),
    db.rpc('list_store_members'),
    Promise.all(TABLES.map((spec) => readAll(db, spec))),
  ]);
  if (store.error) throw fromDbError(store.error);
  if (members.error) throw fromDbError(members.error);

  return {
    createdAt,
    files: [
      toFile('loja.csv', STORE_COLUMNS, [store.data as unknown as Row]),
      toFile(
        'membros.csv',
        ['user_id', 'email'],
        members.data.map((m) => ({ user_id: m.user_id, email: m.email })),
      ),
      ...TABLES.map((spec, i) => toFile(spec.file, spec.columns, tables[i] ?? [])),
    ],
  };
}
