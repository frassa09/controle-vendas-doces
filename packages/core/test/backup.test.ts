import { beforeAll, describe, expect, it } from 'vitest';
import {
  BACKUP_FILE_NAMES,
  backupToZip,
  crc32,
  toCsv,
  type Backup,
  type BackupFileName,
} from '../src';
import { anonymousCore, newSignedInPerson, type TestPerson } from './support/members';

/** Lê um CSV RFC 4180 em objetos por cabeçalho (só para conferir o export). */
function parseCsv(csv: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv.charAt(i);
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && csv[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += ch;
  }
  const [header = [], ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function table(backup: Backup, name: BackupFileName): Record<string, string>[] {
  const file = backup.files.find((f) => f.name === name);
  if (!file) throw new Error(`faltou ${name}`);
  return parseCsv(file.csv);
}

describe('toCsv', () => {
  it('põe cabeçalho, separa por vírgula e usa aspas só quando precisa', () => {
    expect(
      toCsv(
        ['nome', 'obs', 'n', 'ok', 'vazio'],
        [
          ['Júlia', 'mora na rua 2, casa "azul"', 3, true, null],
          ['Bruno', 'linha 1\nlinha 2', 0, false, undefined],
          ['  Ana', '', -5, false, ''],
        ],
      ),
    ).toBe(
      'nome,obs,n,ok,vazio\r\n' +
        'Júlia,"mora na rua 2, casa ""azul""",3,true,\r\n' +
        'Bruno,"linha 1\nlinha 2",0,false,\r\n' +
        '"  Ana",,-5,false,\r\n',
    );
  });

  it('sem linhas, só o cabeçalho', () => {
    expect(toCsv(['id', 'nome'], [])).toBe('id,nome\r\n');
  });
});

/** Lê um zip "stored" pelo diretório central: nome → conteúdo. */
function readZip(zip: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true);
    const data = zip.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);
    files.set(name, data);
    at += 46 + nameLength;
  }
  return files;
}

describe('zip do backup', () => {
  it('crc32 confere com o valor de referência', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('junta os CSVs num zip, em UTF-8 com BOM', () => {
    const backup: Backup = {
      createdAt: '2026-10-26T15:00:00Z',
      files: [
        { name: 'loja.csv', csv: toCsv(['nome'], [['Doces da Júlia']]) },
        { name: 'vendas.csv', csv: toCsv(['id'], []) },
      ],
    };
    const files = readZip(backupToZip(backup));
    expect([...files.keys()]).toEqual(['loja.csv', 'vendas.csv']);
    const bytes = files.get('loja.csv') ?? new Uint8Array();
    // EF BB BF é o BOM do UTF-8.
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.subarray(3))).toBe('nome\r\nDoces da Júlia\r\n');
  });
});

describe('exportar backup', () => {
  let owner: TestPerson;
  let partner: TestPerson;
  let outsider: TestPerson;
  let backup: Backup;
  const ids = {} as {
    store: string;
    products: string[];
    customers: string[];
    sales: string[];
    cancelledSale: string;
    cancelledPayment: string;
    payments: string[];
    play: string;
    coupons: string[];
  };
  const julia = { pin: '4821', token: '' };
  let outsiderIds: string[] = [];

  beforeAll(async () => {
    [owner, partner, outsider] = await Promise.all([
      newSignedInPerson(),
      newSignedInPerson(),
      newSignedInPerson(),
    ]);
    const store = await owner.core.store.createStore({
      name: 'Doces, "da" Júlia',
      pixKey: 'julia@example.com',
      city: 'Belo Horizonte',
    });
    ids.store = store.id;
    await partner.core.store.joinWithInvite((await owner.core.store.createInvite()).code);

    const core = owner.core;
    const brownie = await core.catalog.createProduct({
      name: 'Brownie',
      priceCents: 300,
      points: 2,
      canBePrize: true,
    });
    const bolo = await core.catalog.createProduct({ name: 'Bolo', priceCents: 1200, points: 5 });
    ids.products = [brownie.id, bolo.id];
    const juliaCustomer = await core.customers.createCustomer({
      name: 'Júlia Santos',
      whatsapp: '31 99876-5432',
      pin: julia.pin,
      consented: true,
      notes: 'Prefere sem nozes, "por favor"\nmora no 2º andar',
    });
    julia.token = juliaCustomer.linkToken;
    const bruno = await partner.core.customers.createCustomer({
      name: 'Bruno',
      whatsapp: '31 99876-5433',
      pin: '1234',
      consented: false,
    });
    ids.customers = [juliaCustomer.id, bruno.id];

    // Vendas: paga (gera 20 pontos), fiado editada, e uma cancelada.
    const paid = await core.sales.recordSale({
      customerId: juliaCustomer.id,
      items: [{ productId: bolo.id, quantity: 4 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    const fiado = await partner.core.sales.recordSale({
      customerId: bruno.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });
    await core.sales.updateSale(fiado.id, {
      items: [{ productId: brownie.id, quantity: 3, unitPriceCents: 250 }],
    });
    const cancelled = await core.sales.recordSale({
      customerId: null,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'cash' },
    });
    await core.sales.cancelSale(cancelled.id);
    ids.sales = [paid.id, fiado.id, cancelled.id];
    ids.cancelledSale = cancelled.id;

    const wrongPayment = await core.payments.recordPayment({
      customerId: bruno.id,
      amountCents: 100,
      method: 'pix',
    });
    await core.payments.cancelPayment(wrongPayment.payment.id);
    ids.cancelledPayment = wrongPayment.payment.id;
    const all = await Promise.all(ids.sales.map((id) => core.sales.getSale(id)));
    ids.payments = [...all.flatMap((s) => s.payments.map((p) => p.id)), wrongPayment.payment.id];

    await core.collections.recordSent(bruno.id);

    // Página do cliente: um resgate e uma jogada de raspadinha.
    const page = anonymousCore().customerPage;
    const redeemed = await page.redeemReward({
      token: julia.token,
      pin: julia.pin,
      productId: brownie.id,
    });
    const play = await page.playScratch({
      token: julia.token,
      pin: julia.pin,
      format: 'five_spots',
    });
    ids.play = play.play.id;
    ids.coupons = [redeemed.coupon.id];
    if (play.play.won) {
      const claimed = await page.claimScratchPrize({
        token: julia.token,
        pin: julia.pin,
        playId: play.play.id,
        productId: brownie.id,
      });
      ids.coupons.push(claimed.coupon.id);
    }

    // Outra loja, com dados que não podem aparecer.
    await outsider.core.store.createStore({ name: 'Vizinha', pixKey: 'v@example.com', city: 'BH' });
    const otherProduct = await outsider.core.catalog.createProduct({
      name: 'Cocada',
      priceCents: 200,
      points: 1,
    });
    const otherCustomer = await outsider.core.customers.createCustomer({
      name: 'Carla',
      whatsapp: '31 99876-5434',
      pin: '9999',
      consented: true,
    });
    const otherSale = await outsider.core.sales.recordSale({
      customerId: otherCustomer.id,
      items: [{ productId: otherProduct.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    outsiderIds = [outsider.userId, otherProduct.id, otherCustomer.id, otherSale.id];

    backup = await partner.core.backup.exportBackup();
  }, 60_000);

  it('gera um CSV por entidade, sempre com os mesmos nomes', () => {
    expect(backup.files.map((f) => f.name)).toEqual([...BACKUP_FILE_NAMES]);
    expect(Number.isNaN(Date.parse(backup.createdAt))).toBe(false);
    expect([...readZip(backupToZip(backup)).keys()]).toEqual([...BACKUP_FILE_NAMES]);
  });

  it('loja e membros', () => {
    expect(table(backup, 'loja.csv')).toEqual([
      expect.objectContaining({
        id: ids.store,
        name: 'Doces, "da" Júlia',
        pix_key: 'julia@example.com',
        city: 'Belo Horizonte',
      }),
    ]);
    const members = table(backup, 'membros.csv');
    expect(members.map((m) => m.user_id).sort()).toEqual([owner.userId, partner.userId].sort());
    expect(members.find((m) => m.user_id === owner.userId)?.email).toBe(owner.email);
  });

  it('produtos e clientes completos, sem PIN nem token do link', () => {
    const products = table(backup, 'produtos.csv');
    expect(products.map((p) => p.id).sort()).toEqual([...ids.products].sort());
    expect(products.find((p) => p.name === 'Brownie')).toMatchObject({
      price_cents: '300',
      points: '2',
      can_be_prize: 'true',
      is_active: 'true',
    });

    const customers = table(backup, 'clientes.csv');
    expect(customers.map((c) => c.id).sort()).toEqual([...ids.customers].sort());
    expect(customers.find((c) => c.name === 'Júlia Santos')).toMatchObject({
      whatsapp: '5531998765432',
      notes: 'Prefere sem nozes, "por favor"\nmora no 2º andar',
      consented: 'true',
    });

    const customersFile = backup.files.find((f) => f.name === 'clientes.csv')?.csv ?? '';
    expect(customersFile.split('\r\n')[0]).not.toMatch(/pin|token/);
    const everything = backup.files.map((f) => f.csv).join('\n');
    expect(everything).not.toContain(julia.token);
    const cells = BACKUP_FILE_NAMES.flatMap((name) =>
      table(backup, name).flatMap((row) => Object.values(row)),
    );
    expect(cells).not.toContain('4821');
    expect(cells).not.toContain('1234');
  });

  it('vendas, itens e pagamentos, com os cancelados', () => {
    const sales = table(backup, 'vendas.csv');
    expect(sales.map((s) => s.id).sort()).toEqual([...ids.sales].sort());
    expect(sales.find((s) => s.id === ids.cancelledSale)).toMatchObject({
      status: 'cancelled',
      cancelled_by: owner.userId,
    });
    expect(sales.find((s) => s.id === ids.sales[1])).toMatchObject({
      recorded_by: partner.userId,
      edited_by: owner.userId,
    });

    const items = table(backup, 'itens.csv');
    expect(items).toHaveLength(3);
    expect(new Set(items.map((i) => i.sale_id))).toEqual(new Set(ids.sales));
    expect(items.find((i) => i.sale_id === ids.sales[1])).toMatchObject({
      product_name: 'Brownie',
      quantity: '3',
      unit_price_cents: '250',
    });
    const revisions = table(backup, 'itens-alterados.csv');
    expect(revisions).toEqual([
      expect.objectContaining({ sale_id: ids.sales[1], quantity: '2', unit_price_cents: '300' }),
    ]);

    const payments = table(backup, 'pagamentos.csv');
    expect(payments.map((p) => p.id).sort()).toEqual([...ids.payments].sort());
    expect(payments.find((p) => p.id === ids.cancelledPayment)).toMatchObject({
      status: 'cancelled',
      amount_cents: '100',
    });
  });

  it('pontos, cupons, raspadinhas e cobranças', async () => {
    const points = await owner.core.points.getCustomerPoints(ids.customers[0] ?? '');
    const ledger = table(backup, 'pontos.csv');
    expect(ledger.map((m) => m.id).sort()).toEqual(points.movements.map((m) => m.id).sort());
    expect(ledger.some((m) => m.kind === 'redemption' && m.points === '-10')).toBe(true);

    const coupons = table(backup, 'cupons.csv');
    expect(coupons.map((c) => c.id).sort()).toEqual([...ids.coupons].sort());
    expect(coupons.find((c) => c.origin === 'redemption')).toMatchObject({
      product_name: 'Brownie',
      status: 'pending',
    });

    expect(table(backup, 'raspadinhas.csv')).toEqual([
      expect.objectContaining({
        id: ids.play,
        customer_id: ids.customers[0],
        format: 'five_spots',
      }),
    ]);

    expect(table(backup, 'cobrancas.csv')).toEqual([
      expect.objectContaining({ customer_id: ids.customers[1], recorded_by: owner.userId }),
    ]);
  });

  it('nada de outra loja entra, e a outra loja só vê o que é dela', async () => {
    const everything = backup.files.map((f) => f.csv).join('\n');
    for (const id of outsiderIds) expect(everything).not.toContain(id);

    const theirs = await outsider.core.backup.exportBackup();
    const theirText = theirs.files.map((f) => f.csv).join('\n');
    for (const id of [ids.store, ...ids.products, ...ids.customers, ...ids.sales]) {
      expect(theirText).not.toContain(id);
    }
    expect(table(theirs, 'vendas.csv')).toHaveLength(1);
  });

  it('exige login', async () => {
    await expect(anonymousCore().backup.exportBackup()).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED',
    });
  });
});
