import { beforeAll, describe, expect, it } from 'vitest';
import { isCoreError, type CoreError, type RecordSaleInput } from '../src';
import { anonymousCore, newSignedInPerson, type TestPerson } from './support/members';

async function memberWithStore(): Promise<TestPerson> {
  const owner = await newSignedInPerson();
  await owner.core.store.createStore({
    name: 'Doces da Júlia',
    pixKey: 'julia@example.com',
    city: 'Belo Horizonte',
  });
  return owner;
}

async function errorOf(promise: Promise<unknown>): Promise<CoreError> {
  try {
    await promise;
  } catch (error) {
    if (isCoreError(error)) return error;
    throw error;
  }
  throw new Error('esperava um CoreError');
}

const missingId = '00000000-0000-4000-8000-000000000000';

describe('registrar venda paga na hora', () => {
  it('venda com cliente: itens, total e um pagamento de mesmo valor', async () => {
    const member = await memberWithStore();
    const brownie = await member.core.catalog.createProduct({
      name: 'Brownie',
      priceCents: 300,
      points: 1,
    });
    const combo = await member.core.catalog.createProduct({
      name: '3 brownies',
      priceCents: 800,
      points: 3,
      isCombo: true,
    });
    const julia = await member.core.customers.createCustomer({
      name: 'Júlia',
      whatsapp: '31 99876-5432',
      pin: '4821',
      consented: true,
    });

    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [
        { productId: brownie.id, quantity: 2 },
        { productId: combo.id, quantity: 1 },
      ],
      payment: { type: 'paidNow', method: 'pix' },
    });

    expect(sale).toMatchObject({
      customer: { id: julia.id, name: 'Júlia' },
      status: 'active',
      totalCents: 1400,
      items: [
        { productId: brownie.id, productName: 'Brownie', quantity: 2, unitPriceCents: 300 },
        { productId: combo.id, productName: '3 brownies', quantity: 1, unitPriceCents: 800 },
      ],
      payments: [{ amountCents: 1400, method: 'pix', status: 'active' }],
    });
    expect(await member.core.sales.getSale(sale.id)).toEqual(sale);
  });

  it('venda avulsa: sem cliente, paga em dinheiro', async () => {
    const member = await memberWithStore();
    const brigadeiro = await member.core.catalog.createProduct({
      name: 'Brigadeiro',
      priceCents: 250,
      points: 1,
    });

    const sale = await member.core.sales.recordSale({
      customerId: null,
      items: [{ productId: brigadeiro.id, quantity: 4 }],
      payment: { type: 'paidNow', method: 'cash' },
    });

    expect(sale).toMatchObject({
      customer: null,
      totalCents: 1000,
      items: [{ productName: 'Brigadeiro', quantity: 4, unitPriceCents: 250, totalCents: 1000 }],
      payments: [{ amountCents: 1000, method: 'cash', status: 'active' }],
    });
  });

  it('preço editado no item vale para o item, o total e o pagamento', async () => {
    const member = await memberWithStore();
    const torta = await member.core.catalog.createProduct({ name: 'Torta', priceCents: 1200 });
    const bala = await member.core.catalog.createProduct({ name: 'Bala', priceCents: 50 });

    const sale = await member.core.sales.recordSale({
      customerId: null,
      items: [
        { productId: torta.id, quantity: 2, unitPriceCents: 1000 },
        { productId: bala.id, quantity: 3 },
      ],
      payment: { type: 'paidNow', method: 'pix' },
    });

    expect(sale.items).toMatchObject([
      { productName: 'Torta', quantity: 2, unitPriceCents: 1000, totalCents: 2000 },
      { productName: 'Bala', quantity: 3, unitPriceCents: 50, totalCents: 150 },
    ]);
    expect(sale.totalCents).toBe(2150);
    expect(sale.payments).toMatchObject([{ amountCents: 2150 }]);
  });

  it('itens guardam cópia de nome, preço e pontos: editar o produto não muda a venda', async () => {
    const member = await memberWithStore();
    const brownie = await member.core.catalog.createProduct({
      name: 'Brownie',
      priceCents: 300,
      points: 2,
    });
    const sale = await member.core.sales.recordSale({
      customerId: null,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'pix' },
    });

    await member.core.catalog.updateProduct(brownie.id, {
      name: 'Brownie grande',
      priceCents: 450,
      points: 5,
    });

    const reread = await member.core.sales.getSale(sale.id);
    expect(reread.items).toMatchObject([
      { productName: 'Brownie', unitPriceCents: 300, points: 2, totalCents: 300 },
    ]);
    expect(reread.totalCents).toBe(300);
  });

  it('venda e pagamento registram o membro que lançou e quando', async () => {
    const owner = await memberWithStore();
    const partner = await newSignedInPerson();
    const invite = await owner.core.store.createInvite();
    await partner.core.store.joinWithInvite(invite.code);
    const cocada = await owner.core.catalog.createProduct({ name: 'Cocada', priceCents: 400 });
    const before = Date.now();

    const byPartner = await partner.core.sales.recordSale({
      customerId: null,
      items: [{ productId: cocada.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'cash' },
    });

    const seenByOwner = await owner.core.sales.getSale(byPartner.id);
    expect(seenByOwner.recordedBy).toEqual({ id: partner.userId, email: partner.email });
    expect(seenByOwner.payments[0]?.recordedBy).toEqual({
      id: partner.userId,
      email: partner.email,
    });
    // Hora do servidor; a folga cobre a diferença de relógio com a máquina de testes.
    const createdAt = Date.parse(seenByOwner.createdAt);
    expect(createdAt).toBeGreaterThan(before - 60_000);
    expect(createdAt).toBeLessThan(Date.now() + 60_000);

    const byOwner = await owner.core.sales.recordSale({
      customerId: null,
      items: [{ productId: cocada.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    expect((await partner.core.sales.getSale(byOwner.id)).recordedBy).toEqual({
      id: owner.userId,
      email: owner.email,
    });
  });

  it('produto desativado não entra na venda', async () => {
    const member = await memberWithStore();
    const pudim = await member.core.catalog.createProduct({ name: 'Pudim', priceCents: 900 });
    await member.core.catalog.deactivateProduct(pudim.id);

    const error = await errorOf(
      member.core.sales.recordSale({
        customerId: null,
        items: [{ productId: pudim.id, quantity: 1 }],
        payment: { type: 'paidNow', method: 'pix' },
      }),
    );
    expect(error.code).toBe('PRODUCT_INACTIVE');
  });

  it('cliente, produto ou venda inexistente', async () => {
    const member = await memberWithStore();
    const pe = await member.core.catalog.createProduct({ name: 'Pé de moleque', priceCents: 200 });

    const noCustomer = await errorOf(
      member.core.sales.recordSale({
        customerId: missingId,
        items: [{ productId: pe.id, quantity: 1 }],
        payment: { type: 'paidNow', method: 'pix' },
      }),
    );
    const noProduct = await errorOf(
      member.core.sales.recordSale({
        customerId: null,
        items: [{ productId: missingId, quantity: 1 }],
        payment: { type: 'paidNow', method: 'pix' },
      }),
    );
    const badIds = await errorOf(
      member.core.sales.recordSale({
        customerId: 'abc',
        items: [{ productId: pe.id, quantity: 1 }],
        payment: { type: 'paidNow', method: 'pix' },
      }),
    );

    expect([noCustomer.code, noProduct.code, badIds.code]).toEqual([
      'CUSTOMER_NOT_FOUND',
      'PRODUCT_NOT_FOUND',
      'CUSTOMER_NOT_FOUND',
    ]);
    expect((await errorOf(member.core.sales.getSale(missingId))).code).toBe('SALE_NOT_FOUND');
    expect((await errorOf(member.core.sales.getSale('abc'))).code).toBe('SALE_NOT_FOUND');
  });

  it('quem não tem loja não registra venda', async () => {
    const person = await newSignedInPerson();
    const error = await errorOf(
      person.core.sales.recordSale({
        customerId: null,
        items: [{ productId: missingId, quantity: 1 }],
        payment: { type: 'paidNow', method: 'pix' },
      }),
    );
    expect(error.code).toBe('FORBIDDEN');
  });
});

describe('validação da venda', () => {
  // Nada é gravado: uma loja só para os casos.
  let member: TestPerson;
  let productId: string;
  beforeAll(async () => {
    member = await memberWithStore();
    productId = (await member.core.catalog.createProduct({ name: 'Bolo', priceCents: 500 })).id;
  });

  const paidNow = { type: 'paidNow', method: 'pix' } as const;

  it.each<[string, (id: string) => RecordSaleInput, Record<string, string>]>([
    [
      'sem itens',
      () => ({ customerId: null, items: [], payment: paidNow }),
      { items: 'Toque em pelo menos um produto.' },
    ],
    [
      'quantidade zero',
      (id) => ({ customerId: null, items: [{ productId: id, quantity: 0 }], payment: paidNow }),
      { items: 'A quantidade do item 1 precisa ser de 1 a 999.' },
    ],
    [
      'quantidade quebrada',
      (id) => ({ customerId: null, items: [{ productId: id, quantity: 1.5 }], payment: paidNow }),
      { items: 'A quantidade do item 1 precisa ser de 1 a 999.' },
    ],
    [
      'preço zero no segundo item',
      (id) => ({
        customerId: null,
        items: [
          { productId: id, quantity: 1 },
          { productId: id, quantity: 1, unitPriceCents: 0 },
        ],
        payment: paidNow,
      }),
      { items: 'Item 2: o preço precisa ser maior que zero.' },
    ],
    [
      'preço ilegível',
      (id) => ({
        customerId: null,
        items: [{ productId: id, quantity: 1, unitPriceCents: Number.NaN }],
        payment: paidNow,
      }),
      { items: 'Item 1: informe o preço, como 8,50.' },
    ],
    [
      'total acima de R$ 100.000,00',
      (id) => ({
        customerId: null,
        items: [{ productId: id, quantity: 11, unitPriceCents: 1_000_000 }],
        payment: paidNow,
      }),
      { items: 'O total passa de R$ 100.000,00. Divida em mais de uma venda.' },
    ],
    [
      'forma de pagamento desconhecida',
      (id) => ({
        customerId: null,
        items: [{ productId: id, quantity: 1 }],
        payment: { type: 'paidNow', method: 'cartao' as 'pix' },
      }),
      { payment: 'Escolha Pix ou dinheiro.' },
    ],
  ])('%s', async (_name, build, fieldErrors) => {
    const error = await errorOf(member.core.sales.recordSale(build(productId)));
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.fieldErrors).toEqual(fieldErrors);
  });

  it('o preço padrão também conta para o limite do total', async () => {
    const festa = await member.core.catalog.createProduct({
      name: 'Bolo de festa',
      priceCents: 1_000_000,
    });
    const error = await errorOf(
      member.core.sales.recordSale({
        customerId: null,
        items: [{ productId: festa.id, quantity: 11 }],
        payment: paidNow,
      }),
    );
    expect(error.code).toBe('INVALID_INPUT');
  });

  it('sem login, nada é registrado', async () => {
    const error = await errorOf(
      anonymousCore().sales.recordSale({
        customerId: null,
        items: [{ productId, quantity: 1 }],
        payment: paidNow,
      }),
    );
    expect(error.code).toBe('NOT_AUTHENTICATED');
  });
});
