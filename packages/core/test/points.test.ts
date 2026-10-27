import { describe, expect, it } from 'vitest';
import { isCoreError, type CoreError, type Customer, type Product } from '../src';
import {
  anonymousClient,
  anonymousCore,
  newSignedInPerson,
  type TestPerson,
} from './support/members';

interface Shop {
  member: TestPerson;
  julia: Customer;
  /** R$ 3,00, 2 pontos por unidade. */
  brownie: Product;
  /** Combo de R$ 8,00, 7 pontos. */
  combo: Product;
}

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
    points: 2,
  });
  const combo = await member.core.catalog.createProduct({
    name: '3 brownies',
    priceCents: 800,
    points: 7,
    isCombo: true,
  });
  const julia = await member.core.customers.createCustomer({
    name: 'Júlia',
    whatsapp: '31 99876-5432',
    pin: '4821',
    consented: true,
  });
  return { member, julia, brownie, combo };
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

describe('pontos', () => {
  it('cliente novo começa com saldo zero e extrato vazio', async () => {
    const { member, julia } = await shop();

    expect(await member.core.points.getCustomerPoints(julia.id)).toEqual({
      customerId: julia.id,
      balance: 0,
      expiresAt: null,
      movements: [],
    });
  });

  it('venda paga na hora credita os pontos dos itens, uma vez', async () => {
    const { member, julia, brownie } = await shop();

    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 3 }],
      payment: { type: 'paidNow', method: 'pix' },
    });

    const points = await member.core.points.getCustomerPoints(julia.id);
    expect(points.balance).toBe(6);
    expect(points.movements).toMatchObject([{ kind: 'saleCredit', points: 6, saleId: sale.id }]);
    expect(points.movements).toHaveLength(1);
    // Reler não credita de novo.
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(6);
  });

  it('combo credita os próprios pontos', async () => {
    const { member, julia, combo } = await shop();

    await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: combo.id, quantity: 2 }],
      payment: { type: 'paidNow', method: 'cash' },
    });

    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(14);
  });

  it('venda avulsa nunca gera pontos', async () => {
    const { member, julia, brownie } = await shop();

    await member.core.sales.recordSale({
      customerId: null,
      items: [{ productId: brownie.id, quantity: 5 }],
      payment: { type: 'paidNow', method: 'cash' },
    });

    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(0);
  });

  it('venda fiado não credita até ser quitada; pagamento parcial não credita', async () => {
    const { member, julia, brownie } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(0);

    await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 599,
      method: 'pix',
    });
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(0);

    await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 1,
      method: 'cash',
    });
    const points = await member.core.points.getCustomerPoints(julia.id);
    expect(points.balance).toBe(4);
    expect(points.movements).toMatchObject([{ points: 4, saleId: sale.id }]);
  });

  it('venda quitada por dois pagamentos credita uma única vez', async () => {
    const { member, julia, brownie } = await shop();
    await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });

    await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 100,
      method: 'pix',
    });
    expect((await member.core.points.getCustomerPoints(julia.id)).movements).toHaveLength(0);
    await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 200,
      method: 'pix',
    });

    const points = await member.core.points.getCustomerPoints(julia.id);
    expect(points.balance).toBe(2);
    expect(points.movements).toHaveLength(1);
  });

  it('um pagamento que quita duas vendas credita as duas, e só elas', async () => {
    const { member, julia, brownie, combo } = await shop();
    const first = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });
    const second = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: combo.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });
    // Uma terceira, que continua em aberto.
    await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });

    await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 1100,
      method: 'pix',
    });

    const points = await member.core.points.getCustomerPoints(julia.id);
    expect(points.balance).toBe(9);
    expect(points.movements.map((m) => [m.saleId, m.points]).sort()).toEqual(
      [
        [first.id, 2],
        [second.id, 7],
      ].sort(),
    );
  });

  it('a segunda venda só é creditada quando o pagamento seguinte a fecha', async () => {
    const { member, julia, brownie } = await shop();
    for (let i = 0; i < 2; i++) {
      await member.core.sales.recordSale({
        customerId: julia.id,
        items: [{ productId: brownie.id, quantity: 1 }],
        payment: { type: 'fiado' },
      });
    }
    await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 450,
      method: 'pix',
    });
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(2);
    await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 150,
      method: 'pix',
    });
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(4);
  });

  it('extrato vem do mais novo para o mais antigo', async () => {
    const { member, julia, brownie, combo } = await shop();
    const a = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    const b = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: combo.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'pix' },
    });

    const points = await member.core.points.getCustomerPoints(julia.id);
    expect(points.movements.map((m) => m.saleId)).toEqual([b.id, a.id]);
  });

  it('produto sem pontos não gera movimento', async () => {
    const { member, julia } = await shop();
    const plain = await member.core.catalog.createProduct({ name: 'Água', priceCents: 200 });

    await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: plain.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'cash' },
    });

    expect((await member.core.points.getCustomerPoints(julia.id)).movements).toEqual([]);
  });
});

describe('isolamento dos pontos', () => {
  it('outra loja não vê os pontos, e ninguém grava no livro direto', async () => {
    const { member, julia, brownie } = await shop();
    await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    const stranger = await newSignedInPerson();
    await stranger.core.store.createStore({
      name: 'Outra loja',
      pixKey: 'outra@example.com',
      city: 'Recife',
    });

    expect((await errorOf(stranger.core.points.getCustomerPoints(julia.id))).code).toBe(
      'CUSTOMER_NOT_FOUND',
    );
    const seen = await stranger.rawClient.from('points_ledger').select('id');
    expect(seen.data).toEqual([]);

    const store = await member.core.store.getMyStore();
    const insert = await member.rawClient.from('points_ledger').insert({
      store_id: store?.id ?? '',
      customer_id: julia.id,
      kind: 'sale_credit',
      points: 999,
    });
    expect(insert.error).not.toBeNull();
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(2);
  });

  it('sem login, nada é lido', async () => {
    const { julia } = await shop();

    expect((await errorOf(anonymousCore().points.getCustomerPoints(julia.id))).code).toBe(
      'NOT_AUTHENTICATED',
    );
    const raw = await anonymousClient().from('points_ledger').select('id');
    expect(raw.error).not.toBeNull();
  });
});
