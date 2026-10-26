import { describe, expect, it } from 'vitest';
import { anonymousCore, newSignedInPerson, setRecordTime } from './support/members';

// Semana de teste: segunda 09/03/2026 00:00 a segunda 16/03/2026 (horário de Brasília,
// UTC-3). A semana anterior equivalente é 02/03 a 09/03.
const FROM = '2026-03-09T03:00:00Z';
const TO = '2026-03-16T03:00:00Z';

/** Loja com um conjunto conhecido de vendas e pagamentos, certos e cancelados. */
async function knownShop() {
  const person = await newSignedInPerson();
  const { core } = person;
  await core.store.createStore({ name: 'Doces', pixKey: 'doces@example.com', city: 'Contagem' });
  const brownie = await core.catalog.createProduct({ name: 'Brownie', priceCents: 300, points: 1 });
  const cocada = await core.catalog.createProduct({ name: 'Cocada', priceCents: 200, points: 1 });
  const combo = await core.catalog.createProduct({
    name: '3 brownies',
    priceCents: 800,
    points: 3,
    isCombo: true,
  });
  const newCustomer = (name: string, whatsapp: string) =>
    core.customers.createCustomer({ name, whatsapp, pin: '4821', consented: true });
  const julia = await newCustomer('Júlia', '31 99876-5432');
  const bruno = await newCustomer('Bruno', '31 99876-5433');
  const carla = await newCustomer('Carla', '31 99876-5434');

  const at = async (saleId: string, iso: string, withPayment = true) => {
    await setRecordTime('sales', saleId, iso);
    if (!withPayment) return;
    const sale = await core.sales.getSale(saleId);
    for (const p of sale.payments) await setRecordTime('payments', p.id, iso);
  };
  const pix = { type: 'paidNow', method: 'pix' } as const;
  const cash = { type: 'paidNow', method: 'cash' } as const;

  // Antes das semanas: Carla comprou em janeiro e sumiu.
  await at(
    (
      await core.sales.recordSale({
        customerId: carla.id,
        items: [{ productId: brownie.id, quantity: 1 }],
        payment: cash,
      })
    ).id,
    '2026-01-05T15:00:00Z',
  );

  // Semana anterior: Júlia, terça 03/03 12:00.
  await at(
    (
      await core.sales.recordSale({
        customerId: julia.id,
        items: [{ productId: brownie.id, quantity: 1 }],
        payment: cash,
      })
    ).id,
    '2026-03-03T15:00:00Z',
  );

  // Semana de teste. S1: segunda 10h, Júlia, 2 brownies, Pix.
  await at(
    (
      await core.sales.recordSale({
        customerId: julia.id,
        items: [{ productId: brownie.id, quantity: 2 }],
        payment: pix,
      })
    ).id,
    '2026-03-09T13:00:00Z',
  );
  // S2: quarta 15h30, Bruno, 1 combo + 1 cocada a R$ 1,50 (desconto de 50), fiado.
  const s2 = await core.sales.recordSale({
    customerId: bruno.id,
    items: [
      { productId: combo.id, quantity: 1 },
      { productId: cocada.id, quantity: 1, unitPriceCents: 150 },
    ],
    payment: { type: 'fiado' },
  });
  await at(s2.id, '2026-03-11T18:30:00Z', false);
  // Bruno paga R$ 4 em dinheiro na sexta 09h; um pagamento de R$ 1 foi cancelado.
  const cancelledPayment = await core.payments.recordPayment({
    customerId: bruno.id,
    amountCents: 100,
    method: 'pix',
  });
  await core.payments.cancelPayment(cancelledPayment.payment.id);
  await setRecordTime('payments', cancelledPayment.payment.id, '2026-03-13T11:00:00Z');
  const brunoPayment = await core.payments.recordPayment({
    customerId: bruno.id,
    amountCents: 400,
    method: 'cash',
  });
  await setRecordTime('payments', brunoPayment.payment.id, '2026-03-13T12:00:00Z');
  // S3: sábado 10h45, avulsa, 1 brownie a R$ 2,50 (desconto de 50), dinheiro.
  await at(
    (
      await core.sales.recordSale({
        customerId: null,
        items: [{ productId: brownie.id, quantity: 1, unitPriceCents: 250 }],
        payment: cash,
      })
    ).id,
    '2026-03-14T13:45:00Z',
  );
  // Canceladas (não contam): uma paga na hora e um fiado, ambas da Júlia.
  const s4 = await core.sales.recordSale({
    customerId: julia.id,
    items: [{ productId: brownie.id, quantity: 5 }],
    payment: pix,
  });
  await at(s4.id, '2026-03-10T14:00:00Z');
  await core.sales.cancelSale(s4.id);
  const s5 = await core.sales.recordSale({
    customerId: julia.id,
    items: [{ productId: cocada.id, quantity: 4 }],
    payment: { type: 'fiado' },
  });
  await at(s5.id, '2026-03-12T14:00:00Z', false);
  await core.sales.cancelSale(s5.id);

  return { person, julia, bruno, carla, brownie, cocada, combo };
}

describe('métricas do período', () => {
  it('vendas: faturamento, recebido x a receber, ticket, dia da semana, hora e Pix x dinheiro', async () => {
    const { person } = await knownShop();
    const { period } = await person.core.metrics.getMetrics({ from: FROM, to: TO });

    expect(period.salesCount).toBe(3);
    expect(period.revenueCents).toBe(1800); // 600 + 950 + 250
    expect(period.receivedCents).toBe(1250); // 600 pix + 250 + 400 dinheiro
    expect(period.toReceiveCents).toBe(550); // Bruno ainda deve 950 - 400
    expect(period.averageTicketCents).toBe(600);
    expect(period.byMethod).toEqual({
      pix: { count: 1, cents: 600 },
      cash: { count: 2, cents: 650 },
    });
    expect(period.byWeekday.map((d) => d.salesCount)).toEqual([0, 1, 0, 1, 0, 0, 1]);
    expect(period.byWeekday.map((d) => d.revenueCents)).toEqual([0, 600, 0, 950, 0, 0, 250]);
    expect(period.byHour).toHaveLength(24);
    expect(period.byHour[10]).toEqual({ hour: 10, salesCount: 2, revenueCents: 850 });
    expect(period.byHour[15]).toEqual({ hour: 15, salesCount: 1, revenueCents: 950 });
    expect(period.byHour.reduce((sum, h) => sum + h.salesCount, 0)).toBe(3);
  });

  it('produtos, combos e descontos', async () => {
    const { person, brownie, cocada, combo } = await knownShop();
    const { period } = await person.core.metrics.getMetrics({ from: FROM, to: TO });

    expect(period.products).toEqual([
      {
        productId: brownie.id,
        name: 'Brownie',
        isCombo: false,
        quantity: 3,
        revenueCents: 850,
        discountCents: 50,
      },
      {
        productId: combo.id,
        name: '3 brownies',
        isCombo: true,
        quantity: 1,
        revenueCents: 800,
        discountCents: 0,
      },
      {
        productId: cocada.id,
        name: 'Cocada',
        isCombo: false,
        quantity: 1,
        revenueCents: 150,
        discountCents: 50,
      },
    ]);
    expect(period.combos).toEqual({ quantity: 1, revenueCents: 800 });
    expect(period.discounts).toEqual({ totalCents: 100, units: 2, salesCount: 2 });
  });

  it('clientes: melhores, novos x recorrentes, sumidos e frequência', async () => {
    const { person, julia, bruno, carla } = await knownShop();
    const { period } = await person.core.metrics.getMetrics({ from: FROM, to: TO });

    expect(period.customers.buyersCount).toBe(2);
    expect(period.customers.walkInSalesCount).toBe(1);
    expect(period.customers.newCount).toBe(1); // Bruno
    expect(period.customers.returningCount).toBe(1); // Júlia
    expect(period.customers.averageFrequency).toBe(1);
    expect(period.customers.top).toEqual([
      { customerId: bruno.id, name: 'Bruno', salesCount: 1, totalCents: 950 },
      { customerId: julia.id, name: 'Júlia', salesCount: 1, totalCents: 600 },
    ]);
    expect(period.customers.lapsedCount).toBe(1);
    expect(period.customers.lapsed).toEqual([
      {
        customerId: carla.id,
        name: 'Carla',
        salesCount: 1,
        totalCents: 300,
        lastPurchaseAt: '2026-01-05T15:00:00+00:00',
      },
    ]);
  });

  it('traz o período anterior equivalente (mesmo tamanho, logo antes)', async () => {
    const { person, julia } = await knownShop();
    const { previous } = await person.core.metrics.getMetrics({ from: FROM, to: TO });

    expect(previous.from).toBe('2026-03-02T03:00:00.000Z');
    expect(previous.to).toBe('2026-03-09T03:00:00.000Z');
    expect(previous.salesCount).toBe(1);
    expect(previous.revenueCents).toBe(300);
    expect(previous.receivedCents).toBe(300);
    expect(previous.toReceiveCents).toBe(0);
    expect(previous.averageTicketCents).toBe(300);
    expect(previous.byMethod).toEqual({
      pix: { count: 0, cents: 0 },
      cash: { count: 1, cents: 300 },
    });
    expect(previous.byWeekday[2]).toEqual({ weekday: 2, salesCount: 1, revenueCents: 300 });
    expect(previous.byHour[12]).toEqual({ hour: 12, salesCount: 1, revenueCents: 300 });
    expect(previous.discounts).toEqual({ totalCents: 0, units: 0, salesCount: 0 });
    expect(previous.combos).toEqual({ quantity: 0, revenueCents: 0 });
    expect(previous.customers).toMatchObject({
      buyersCount: 1,
      newCount: 1,
      returningCount: 0,
      averageFrequency: 1,
      lapsedCount: 1,
    });
    expect(previous.customers.top).toEqual([
      { customerId: julia.id, name: 'Júlia', salesCount: 1, totalCents: 300 },
    ]);
  });

  it('aceita o período anterior explícito (ex.: mês anterior de calendário)', async () => {
    const { person } = await knownShop();
    const { previous } = await person.core.metrics.getMetrics({
      from: FROM,
      to: TO,
      previous: { from: '2026-02-01T03:00:00Z', to: '2026-03-01T03:00:00Z' },
    });
    expect(previous.salesCount).toBe(0);
    expect(previous.revenueCents).toBe(0);
    expect(previous.averageTicketCents).toBe(0);
    expect(previous.customers.averageFrequency).toBe(0);
    expect(previous.products).toEqual([]);
  });

  it('o fuso muda o horário e o dia da venda', async () => {
    const { person } = await knownShop();
    // Em UTC a venda de segunda 10h de Brasília cai às 13h, e a de sábado às 13h.
    const { period } = await person.core.metrics.getMetrics({
      from: FROM,
      to: TO,
      timeZone: 'UTC',
    });
    expect(period.byHour[13]).toEqual({ hour: 13, salesCount: 2, revenueCents: 850 });
    expect(period.byHour[10]?.salesCount).toBe(0);
  });

  it('o prazo de sumido é configurável', async () => {
    const { person, julia } = await knownShop();
    // Com 3 dias, quem comprou só na semana anterior ou antes também está sumido
    // quando o período termina; no período de teste, só a Carla (a Júlia comprou nele).
    const { previous } = await person.core.metrics.getMetrics({
      from: FROM,
      to: TO,
      lapsedAfterDays: 3,
    });
    expect(previous.customers.lapsedCount).toBe(2);
    expect(previous.customers.lapsed.map((c) => c.customerId)).toContain(julia.id);
  });

  it('período vazio devolve zeros, sem erro', async () => {
    const { person } = await knownShop();
    const { period } = await person.core.metrics.getMetrics({
      from: '2025-01-01T00:00:00Z',
      to: '2025-01-08T00:00:00Z',
    });
    expect(period).toMatchObject({
      salesCount: 0,
      revenueCents: 0,
      receivedCents: 0,
      toReceiveCents: 0,
      averageTicketCents: 0,
      products: [],
    });
    expect(period.byWeekday).toHaveLength(7);
    expect(period.customers).toMatchObject({ buyersCount: 0, top: [], averageFrequency: 0 });
  });
});

describe('métricas: erros e isolamento', () => {
  it('recusa período invertido, datas inválidas e fuso desconhecido', async () => {
    const person = await newSignedInPerson();
    await person.core.store.createStore({ name: 'Doces', pixKey: 'a@example.com', city: 'Rio' });
    const bad = [
      { from: TO, to: FROM },
      { from: FROM, to: FROM },
      { from: 'ontem', to: TO },
      { from: FROM, to: TO, timeZone: 'Marte/Olimpo' },
      { from: FROM, to: TO, lapsedAfterDays: 0 },
    ];
    for (const options of bad) {
      await expect(person.core.metrics.getMetrics(options)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    }
  });

  it('exige login', async () => {
    await expect(anonymousCore().metrics.getMetrics({ from: FROM, to: TO })).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED',
    });
  });

  it('outra loja não enxerga nem soma as vendas desta', async () => {
    await knownShop();
    const other = await newSignedInPerson();
    await other.core.store.createStore({ name: 'Outra', pixKey: 'o@example.com', city: 'Rio' });
    const { period } = await other.core.metrics.getMetrics({ from: FROM, to: TO });
    expect(period.salesCount).toBe(0);
    expect(period.customers.lapsedCount).toBe(0);
    expect(period.products).toEqual([]);
  });
});
