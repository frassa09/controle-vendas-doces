import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  createCore,
  crc16,
  DEFAULT_COLLECTION_TEMPLATE,
  isCoreError,
  type CollectionRange,
  type CoreError,
  type Customer,
  type Product,
} from '../src';
import { testEnv } from './support/env';
import { anonymousCore, newSignedInPerson, type TestPerson } from './support/members';

// Só para ajustar a data das vendas da fixture (o core grava a hora do banco).
const admin = createClient(testEnv.url, testEnv.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DAY_MS = 24 * 60 * 60 * 1000;

async function errorOf(promise: Promise<unknown>): Promise<CoreError> {
  try {
    await promise;
  } catch (error) {
    if (isCoreError(error)) return error;
    throw error;
  }
  throw new Error('esperava um CoreError');
}

interface Shop {
  member: TestPerson;
  brownie: Product;
  cookie: Product;
}

/** Uma loja com brownie (R$ 3,00) e cookie (R$ 5,00). */
async function shop(): Promise<Shop> {
  const member = await newSignedInPerson();
  await member.core.store.createStore({
    name: 'Doces da Júlia',
    pixKey: 'julia@example.com',
    city: 'Belo Horizonte',
  });
  const brownie = await member.core.catalog.createProduct({
    name: 'Brownie',
    priceCents: 300,
    points: 1,
  });
  const cookie = await member.core.catalog.createProduct({
    name: 'Cookie',
    priceCents: 500,
    points: 1,
  });
  return { member, brownie, cookie };
}

async function customer(member: TestPerson, name: string, whatsapp: string): Promise<Customer> {
  return member.core.customers.createCustomer({ name, whatsapp, pin: '4821', consented: true });
}

/** Venda fiado com a data ajustada para `at`. */
async function fiado(
  { member }: Shop,
  customerId: string,
  items: { productId: string; quantity: number }[],
  at: string | number,
): Promise<void> {
  const sale = await member.core.sales.recordSale({
    customerId,
    items,
    payment: { type: 'fiado' },
  });
  const { error } = await admin
    .from('sales')
    .update({ created_at: new Date(at).toISOString() })
    .eq('id', sale.id);
  if (error) throw error;
}

describe('fila de cobrança', () => {
  it('lista só quem deve, da dívida mais antiga para a mais nova, com valor, dias e última cobrança', async () => {
    const s = await shop();
    const { member, brownie } = s;
    const now = Date.now();
    const cris = await customer(member, 'Cris', '31 99111-0003');
    const ana = await customer(member, 'Ana', '31 99111-0001');
    const bia = await customer(member, 'Bia', '31 99111-0002');
    const dani = await customer(member, 'Dani', '31 99111-0004');
    const one = [{ productId: brownie.id, quantity: 1 }];

    await fiado(s, cris.id, one, now - 3 * DAY_MS);
    await fiado(s, ana.id, [{ productId: brownie.id, quantity: 2 }], now - 40 * DAY_MS);
    await fiado(s, bia.id, one, now - 10 * DAY_MS);
    await fiado(s, dani.id, one, now - 20 * DAY_MS);
    await member.core.payments.recordPayment({
      customerId: dani.id,
      amountCents: 300,
      method: 'pix',
    });
    await member.core.sales.recordSale({
      customerId: ana.id,
      items: one,
      payment: { type: 'paidNow', method: 'cash' },
    });

    const sent = await member.core.collections.recordSent(bia.id);
    const queue = await member.core.collections.getQueue();

    expect(queue.map((item) => item.name)).toEqual(['Ana', 'Bia', 'Cris']);
    expect(queue.map((item) => item.balanceCents)).toEqual([600, 300, 300]);
    expect(queue.map((item) => item.daysOpen)).toEqual([40, 10, 3]);
    expect(queue.map((item) => item.lastCollectionAt)).toEqual([null, sent.createdAt, null]);
    expect(queue[0]).toMatchObject({ customerId: ana.id, whatsapp: '5531991110001' });
  });

  it('a idade da dívida segue a venda mais antiga ainda em aberto (FIFO)', async () => {
    const s = await shop();
    const { member, brownie } = s;
    const now = Date.now();
    const ana = await customer(member, 'Ana', '31 99111-0001');
    const one = [{ productId: brownie.id, quantity: 1 }];
    await fiado(s, ana.id, one, now - 40 * DAY_MS);
    await fiado(s, ana.id, one, now - 5 * DAY_MS);

    // R$ 3,00 quitam a venda antiga; sobra só a de 5 dias.
    await member.core.payments.recordPayment({
      customerId: ana.id,
      amountCents: 300,
      method: 'pix',
    });

    const [item] = await member.core.collections.getQueue();
    expect(item).toMatchObject({ balanceCents: 300, daysOpen: 5 });
  });

  it('filtra por faixa de atraso: até 7, de 8 a 30 e mais de 30 dias', async () => {
    const s = await shop();
    const { member, brownie } = s;
    const now = Date.now();
    const one = [{ productId: brownie.id, quantity: 1 }];
    const ages: [string, number][] = [
      ['Hoje', 0],
      ['Sete', 7],
      ['Oito', 8],
      ['Trinta', 30],
      ['TrintaEUm', 31],
    ];
    let phone = 1;
    for (const [name, days] of ages) {
      const person = await customer(member, name, `31 99222-${String(phone++).padStart(4, '0')}`);
      // Um minuto a mais para não cair na fronteira do dia.
      await fiado(s, person.id, one, now - days * DAY_MS - 60_000);
    }
    const names = async (range: CollectionRange) =>
      (await member.core.collections.getQueue({ range })).map((item) => item.name);

    expect(await names('all')).toEqual(['TrintaEUm', 'Trinta', 'Oito', 'Sete', 'Hoje']);
    expect(await names('upTo7')).toEqual(['Sete', 'Hoje']);
    expect(await names('upTo30')).toEqual(['Trinta', 'Oito']);
    expect(await names('over30')).toEqual(['TrintaEUm']);
  });

  it('não mostra devedores de outra loja e exige login', async () => {
    const mine = await shop();
    const other = await shop();
    const ana = await customer(other.member, 'Ana', '31 99111-0001');
    await fiado(other, ana.id, [{ productId: other.brownie.id, quantity: 1 }], Date.now());

    expect(await mine.member.core.collections.getQueue()).toEqual([]);
    expect((await errorOf(anonymousCore().collections.getQueue())).code).toBe('NOT_AUTHENTICATED');
  });
});

describe('mensagem de cobrança', () => {
  it('traz os itens e datas em aberto pela alocação FIFO, o total, o Pix com o valor e o link', async () => {
    const s = await shop();
    const { member, brownie, cookie } = s;
    const ana = await customer(member, 'Ana', '31 99111-0001');
    await fiado(s, ana.id, [{ productId: brownie.id, quantity: 2 }], '2026-09-01T15:00:00Z');
    await fiado(
      s,
      ana.id,
      [
        { productId: brownie.id, quantity: 1 },
        { productId: cookie.id, quantity: 1 },
      ],
      '2026-10-10T15:00:00Z',
    );
    // R$ 4,00 abatem a venda mais antiga (R$ 6,00): restam R$ 2,00 dela.
    await member.core.payments.recordPayment({
      customerId: ana.id,
      amountCents: 400,
      method: 'pix',
    });

    const withLink = createCore({
      supabase: member.rawClient,
      customerPageUrl: 'https://cantinho.example/',
    });
    const message = await withLink.collections.buildMessage(ana.id);
    const profile = await member.core.customers.getCustomer(ana.id);

    const pix = message.pixCode;
    expect(crc16(pix.slice(0, -4))).toBe(pix.slice(-4));
    expect(pix).toContain('540510.00'); // saldo: 6 + 8 - 4 = R$ 10,00
    expect(pix).toContain('5914DOCES DA JULIA');
    expect(message.balanceCents).toBe(1000);
    expect(message.text).toBe(
      [
        'Oi, Ana! Tudo bem por aí?',
        '',
        'Passando com todo carinho só pra lembrar dos docinhos que ficaram pendentes:',
        '',
        '• 01/09 – 2x Brownie – R$ 2,00 (falta de R$ 6,00)',
        '• 10/10 – 1x Brownie, 1x Cookie – R$ 8,00',
        '',
        'Total: R$ 10,00',
        '',
        'Se ficar mais fácil, dá pra pagar por Pix: é só copiar o código abaixo e colar no app do seu banco (o valor já vai certinho).',
        '',
        pix,
        '',
        `Aqui está o seu cantinho, com tudo direitinho: https://cantinho.example/c/${profile.linkToken}`,
        '',
        'Qualquer coisa é só me chamar. Um abraço!',
      ].join('\n'),
    );
    expect(message.whatsappUrl).toBe(
      `https://wa.me/5531991110001?text=${encodeURIComponent(message.text)}`,
    );
  });

  it('vendas quitadas não entram na mensagem; sem endereço da página a linha do link some', async () => {
    const s = await shop();
    const { member, brownie, cookie } = s;
    const ana = await customer(member, 'Ana', '31 99111-0001');
    await fiado(s, ana.id, [{ productId: brownie.id, quantity: 1 }], '2026-09-01T15:00:00Z');
    await fiado(s, ana.id, [{ productId: cookie.id, quantity: 1 }], '2026-10-10T15:00:00Z');
    await member.core.payments.recordPayment({
      customerId: ana.id,
      amountCents: 300,
      method: 'cash',
    });

    const { text } = await member.core.collections.buildMessage(ana.id);

    expect(text).toContain('• 10/10 – 1x Cookie – R$ 5,00');
    expect(text).not.toContain('Brownie');
    expect(text).toContain('Total: R$ 5,00');
    expect(text).not.toContain('seu cantinho');
    expect(text).not.toContain('{');
  });

  it('cliente sem dívida, inexistente ou de outra loja não gera mensagem', async () => {
    const s = await shop();
    const other = await shop();
    const ana = await customer(s.member, 'Ana', '31 99111-0001');
    const stranger = await customer(other.member, 'Zé', '31 99111-0009');

    expect((await errorOf(s.member.core.collections.buildMessage(ana.id))).code).toBe('NO_DEBT');
    expect((await errorOf(s.member.core.collections.buildMessage(stranger.id))).code).toBe(
      'CUSTOMER_NOT_FOUND',
    );
    expect((await errorOf(s.member.core.collections.buildMessage('nao-e-uuid'))).code).toBe(
      'CUSTOMER_NOT_FOUND',
    );
  });
});

describe('texto-modelo da loja', () => {
  it('começa no texto padrão carinhoso e pode ser editado e restaurado', async () => {
    const { member } = await shop();

    expect(await member.core.collections.getTemplate()).toEqual({
      template: DEFAULT_COLLECTION_TEMPLATE,
      isDefault: true,
    });
    expect(DEFAULT_COLLECTION_TEMPLATE).toContain('com todo carinho');

    const saved = await member.core.collections.setTemplate('  Oi {nome}, são {total}. {pix}  ');
    expect(saved).toEqual({ template: 'Oi {nome}, são {total}. {pix}', isDefault: false });
    expect(await member.core.collections.getTemplate()).toEqual(saved);

    expect(await member.core.collections.setTemplate(null)).toEqual({
      template: DEFAULT_COLLECTION_TEMPLATE,
      isDefault: true,
    });
  });

  it('a mensagem usa o texto-modelo salvo pela loja', async () => {
    const s = await shop();
    const { member, brownie } = s;
    const ana = await customer(member, 'Ana', '31 99111-0001');
    await fiado(s, ana.id, [{ productId: brownie.id, quantity: 1 }], '2026-10-10T15:00:00Z');
    await member.core.collections.setTemplate('{nome}: {total}\n{itens}');

    const { text } = await member.core.collections.buildMessage(ana.id);

    expect(text).toBe('Ana: R$ 3,00\n• 10/10 – 1x Brownie – R$ 3,00');
  });

  it('recusa texto vazio, grande demais ou com variável desconhecida', async () => {
    const { member } = await shop();

    const empty = await errorOf(member.core.collections.setTemplate('   '));
    expect(empty.fieldErrors).toEqual({ template: 'Escreva o texto da cobrança.' });

    const long = await errorOf(member.core.collections.setTemplate('a'.repeat(1501)));
    expect(long.fieldErrors).toEqual({ template: 'Use no máximo 1500 caracteres.' });

    const unknown = await errorOf(member.core.collections.setTemplate('Oi {nome} {apelido}'));
    expect(unknown.code).toBe('INVALID_INPUT');
    expect(unknown.fieldErrors.template).toBe(
      'Variável desconhecida: {apelido}. Use {nome}, {itens}, {total}, {pix}, {link}.',
    );
  });

  it('é por loja: o texto de uma não aparece na outra', async () => {
    const a = await shop();
    const b = await shop();
    await a.member.core.collections.setTemplate('Só da loja A {nome}');

    expect((await b.member.core.collections.getTemplate()).isDefault).toBe(true);
  });
});

describe('registrar cobrança enviada', () => {
  it('guarda o saldo da hora e aparece como última cobrança na fila', async () => {
    const s = await shop();
    const { member, brownie } = s;
    const ana = await customer(member, 'Ana', '31 99111-0001');
    await fiado(s, ana.id, [{ productId: brownie.id, quantity: 2 }], Date.now() - 2 * DAY_MS);

    const first = await member.core.collections.recordSent(ana.id);
    await member.core.payments.recordPayment({
      customerId: ana.id,
      amountCents: 100,
      method: 'pix',
    });
    const second = await member.core.collections.recordSent(ana.id);

    expect(first).toMatchObject({ customerId: ana.id, amountCents: 600 });
    expect(second.amountCents).toBe(500);
    const [item] = await member.core.collections.getQueue();
    expect(item?.lastCollectionAt).toBe(second.createdAt);
  });

  it('recusa cliente sem dívida, de outra loja ou sem login; o banco direto não grava', async () => {
    const s = await shop();
    const other = await shop();
    const ana = await customer(s.member, 'Ana', '31 99111-0001');
    const stranger = await customer(other.member, 'Zé', '31 99111-0009');
    await fiado(other, stranger.id, [{ productId: other.brownie.id, quantity: 1 }], Date.now());

    expect((await errorOf(s.member.core.collections.recordSent(ana.id))).code).toBe('NO_DEBT');
    expect((await errorOf(s.member.core.collections.recordSent(stranger.id))).code).toBe(
      'CUSTOMER_NOT_FOUND',
    );
    expect((await errorOf(anonymousCore().collections.recordSent(ana.id))).code).toBe(
      'NOT_AUTHENTICATED',
    );

    const raw = await s.member.rawClient.from('collections').insert({
      store_id: crypto.randomUUID(),
      customer_id: ana.id,
      amount_cents: 1,
      recorded_by: s.member.userId,
    });
    expect(raw.error).not.toBeNull();
  });
});
