import { describe, expect, it } from 'vitest';
import { newSignedInPerson } from './support/members';

async function shop(name: string) {
  const person = await newSignedInPerson();
  await person.core.store.createStore({ name, pixKey: `${name}@example.com`, city: 'Contagem' });
  const brownie = await person.core.catalog.createProduct({
    name: 'Brownie',
    priceCents: 300,
    points: 1,
  });
  return { person, brownie };
}

describe('listar vendas: ordem, avulsa e fiado', () => {
  it('traz as mais novas primeiro, com cliente, resumo, total e situação', async () => {
    const { person, brownie } = await shop('Ana');
    const julia = await person.core.customers.createCustomer({
      name: 'Júlia',
      whatsapp: '31 99876-5432',
      pin: '4821',
      consented: true,
    });
    await person.core.sales.recordSale({
      customerId: null,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'cash' },
    });
    await person.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });

    const list = await person.core.sales.listSales();
    expect(list.map((s) => s.customerName)).toEqual(['Júlia', null]);
    expect(list[0]).toMatchObject({
      summary: '2× Brownie',
      totalCents: 600,
      standing: { type: 'fiado', status: 'open' },
    });
    expect(list[1]).toMatchObject({
      totalCents: 300,
      standing: { type: 'paidNow', method: 'cash' },
    });

    await person.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 200,
      method: 'pix',
    });
    expect((await person.core.sales.listSales({ limit: 1 }))[0]?.standing).toEqual({
      type: 'fiado',
      status: 'partial',
    });
    expect(await person.core.sales.listSales({ to: '2000-01-01T00:00:00Z' })).toEqual([]);
  });
});

describe('listar vendas: isolamento', () => {
  it('outra loja não vê as vendas', async () => {
    const { person, brownie } = await shop('Ana2');
    await person.core.sales.recordSale({
      customerId: null,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    const { person: other } = await shop('Bruno');
    expect(await other.core.sales.listSales()).toEqual([]);
    expect(await person.core.sales.listSales()).toHaveLength(1);
  });
});
