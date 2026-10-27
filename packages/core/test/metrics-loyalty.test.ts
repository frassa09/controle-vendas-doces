import { describe, expect, it } from 'vitest';
import {
  ageCustomerPoints,
  anonymousCore,
  newSignedInPerson,
  setRecordTime,
} from './support/members';

// Semana de teste: 09/03/2026 a 16/03/2026 (Brasília). A anterior é 02/03 a 09/03.
const FROM = '2026-03-09T03:00:00Z';
const TO = '2026-03-16T03:00:00Z';

/**
 * Carteira de fiado conhecida (idades contadas até o fim de cada semana):
 *  - Ana: fiado de R$ 10 em 10/01, pagou R$ 6 em 01/02. Deve R$ 4 há mais de 30 dias.
 *  - Davi: fiado de R$ 5 em 01/02, quitou em 10/03 (37 dias depois, na semana de teste).
 *  - Eva: fiado de R$ 3 em 01/03, segue em aberto (7 dias na anterior, 15 na de teste).
 *  - Fábio: fiado de R$ 2 em 12/03, quitou em 14/03 (2 dias).
 */
async function debtShop() {
  const person = await newSignedInPerson();
  const { core } = person;
  await core.store.createStore({ name: 'Doces', pixKey: 'doces@example.com', city: 'Contagem' });
  const doce = await core.catalog.createProduct({ name: 'Doce', priceCents: 100, points: 0 });

  const fiado = async (name: string, whatsapp: string, units: number, iso: string) => {
    const customer = await core.customers.createCustomer({
      name,
      whatsapp,
      pin: '4821',
      consented: true,
    });
    const sale = await core.sales.recordSale({
      customerId: customer.id,
      items: [{ productId: doce.id, quantity: units }],
      payment: { type: 'fiado' },
    });
    await setRecordTime('sales', sale.id, iso);
    return customer;
  };
  const pay = async (customerId: string, amountCents: number, iso: string) => {
    const { payment } = await core.payments.recordPayment({
      customerId,
      amountCents,
      method: 'pix',
    });
    await setRecordTime('payments', payment.id, iso);
  };

  const ana = await fiado('Ana', '31 99876-5401', 10, '2026-01-10T15:00:00Z');
  await pay(ana.id, 600, '2026-02-01T15:00:00Z');
  const davi = await fiado('Davi', '31 99876-5402', 5, '2026-02-01T15:00:00Z');
  await pay(davi.id, 500, '2026-03-10T15:00:00Z');
  await fiado('Eva', '31 99876-5403', 3, '2026-03-01T15:00:00Z');
  const fabio = await fiado('Fábio', '31 99876-5404', 2, '2026-03-12T15:00:00Z');
  await pay(fabio.id, 200, '2026-03-14T15:00:00Z');
  return person;
}

describe('métricas de cobrança', () => {
  it('foto da dívida no fim do período, faixas de atraso, tempo até pagar e inadimplência', async () => {
    const person = await debtShop();
    const { period, previous } = await person.core.metrics.getMetrics({ from: FROM, to: TO });

    expect(period.collection).toEqual({
      openCents: 700, // Ana 400 + Eva 300
      debtorsCount: 2,
      debtByAge: {
        upTo7: { cents: 0, customersCount: 0 },
        upTo30: { cents: 300, customersCount: 1 },
        over30: { cents: 400, customersCount: 1 },
      },
      settledCount: 2, // Davi e Fábio
      averageDaysToPay: 19.5, // (37 + 2) / 2
      defaultRate: {
        overdueDays: 30,
        fiadoCents: 1500, // Ana 1000 + Davi 500
        openCents: 400,
        percent: 26.7,
      },
    });

    // Na semana anterior o Davi ainda devia e o Fábio nem tinha comprado.
    expect(previous.collection).toEqual({
      openCents: 1200,
      debtorsCount: 3,
      debtByAge: {
        upTo7: { cents: 300, customersCount: 1 },
        upTo30: { cents: 0, customersCount: 0 },
        over30: { cents: 900, customersCount: 2 },
      },
      settledCount: 0,
      averageDaysToPay: null,
      defaultRate: { overdueDays: 30, fiadoCents: 1500, openCents: 900, percent: 60 },
    });
  });

  it('inadimplência: dívida com até 30 dias está no prazo e não entra', async () => {
    const person = await debtShop();
    // Fim do período em 20/02: a dívida da Ana (41 dias) entra; a do Davi (19 dias) não.
    const { period } = await person.core.metrics.getMetrics({
      from: '2026-02-13T03:00:00Z',
      to: '2026-02-20T03:00:00Z',
    });
    expect(period.collection.defaultRate).toEqual({
      overdueDays: 30,
      fiadoCents: 1000,
      openCents: 400,
      percent: 40,
    });
    expect(period.collection.debtByAge.upTo30).toEqual({ cents: 500, customersCount: 1 });

    // Sem fiado com mais de 30 dias a taxa não existe (não é 0%).
    const early = await person.core.metrics.getMetrics({
      from: '2026-01-10T03:00:00Z',
      to: '2026-01-17T03:00:00Z',
    });
    expect(early.period.collection.defaultRate).toMatchObject({ fiadoCents: 0, percent: null });
    expect(early.period.collection.openCents).toBe(1000);
  });
});

describe('métricas de fidelidade', () => {
  it('pontos emitidos, estornados, gastos e vencidos; jogadas; custo dos prêmios entregues', async () => {
    const person = await newSignedInPerson();
    const { core } = person;
    await core.store.createStore({ name: 'Doces', pixKey: 'doces@example.com', city: 'Contagem' });
    await core.store.updatePointsValidity(30);
    await core.store.updateRewardSettings({ redeemCost: 4, scratchCost: 5 });
    const bolo = await core.catalog.createProduct({ name: 'Bolo', priceCents: 1200, points: 5 });
    const brownie = await core.catalog.createProduct({
      name: 'Brownie',
      priceCents: 300,
      points: 0,
      canBePrize: true,
    });
    const pote = await core.catalog.createProduct({
      name: 'Bolo de pote',
      priceCents: 450,
      points: 0,
      canBePrize: true,
    });
    const newCustomer = (name: string, whatsapp: string) =>
      core.customers.createCustomer({ name, whatsapp, pin: '4821', consented: true });
    const julia = await newCustomer('Júlia', '31 99876-5432');
    const gil = await newCustomer('Gil', '31 99876-5433');
    const buy = (customerId: string, quantity: number) =>
      core.sales.recordSale({
        customerId,
        items: [{ productId: bolo.id, quantity }],
        payment: { type: 'paidNow', method: 'pix' },
      });
    const page = anonymousCore().customerPage;
    const token = julia.linkToken;

    // Gil ganhou 5 pontos há 40 dias: venceram há 10 (o vencimento leva a data do prazo).
    await buy(gil.id, 1);
    await ageCustomerPoints(gil.id, 40);

    // Júlia: +20, +5 estornados, troca 2 brownies (8), raspa 2 vezes (10).
    await buy(julia.id, 4);
    await core.sales.cancelSale((await buy(julia.id, 1)).id);
    const redeemed = await page.redeemReward({ token, pin: '4821', productId: brownie.id });
    await core.coupons.deliverCoupon(redeemed.coupon.id);
    await page.redeemReward({ token, pin: '4821', productId: brownie.id }); // fica pendente
    await core.store.updateRewardSettings({ scratchWinPercent: 100 });
    const won = await page.playScratch({ token, pin: '4821', format: 'five_spots' });
    const prize = await page.claimScratchPrize({
      token,
      pin: '4821',
      playId: won.play.id,
      productId: pote.id,
    });
    await core.coupons.deliverCoupon(prize.coupon.id);
    await core.store.updateRewardSettings({ scratchWinPercent: 0 });
    await page.playScratch({ token, pin: '4821', format: 'match_three' });

    // Últimos 11 dias: pega o vencimento do Gil, mas não o crédito dele.
    const now = Date.now();
    const range = {
      from: new Date(now - 11 * 86_400_000).toISOString(),
      to: new Date(now + 3_600_000).toISOString(),
    };
    const { period, previous } = await core.metrics.getMetrics(range);

    expect(period.loyalty).toEqual({
      points: { issued: 25, reversed: 5, redeemed: 8, scratched: 10, expired: 5 },
      scratch: { plays: 2, wins: 1, winPercent: 50, configuredPercent: 50 },
      prizes: {
        count: 2,
        costCents: 750,
        redemption: { count: 1, cents: 300 },
        scratch: { count: 1, cents: 450 },
      },
    });
    expect(previous.loyalty).toEqual({
      points: { issued: 0, reversed: 0, redeemed: 0, scratched: 0, expired: 0 },
      scratch: { plays: 0, wins: 0, winPercent: null, configuredPercent: null },
      prizes: {
        count: 0,
        costCents: 0,
        redemption: { count: 0, cents: 0 },
        scratch: { count: 0, cents: 0 },
      },
    });

    // O custo usa o preço atual do produto (o cupom não guarda o preço da hora).
    await core.catalog.updateProduct(brownie.id, {
      name: 'Brownie',
      priceCents: 350,
      points: 0,
      canBePrize: true,
    });
    const repriced = await core.metrics.getMetrics(range);
    expect(repriced.period.loyalty.prizes.redemption.cents).toBe(350);

    // Outra loja não enxerga nada disso.
    const other = await newSignedInPerson();
    await other.core.store.createStore({ name: 'Outra', pixKey: 'o@example.com', city: 'Rio' });
    const theirs = await other.core.metrics.getMetrics(range);
    expect(theirs.period.loyalty.points.issued).toBe(0);
    expect(theirs.period.loyalty.prizes.count).toBe(0);
    expect(theirs.period.collection.openCents).toBe(0);
  });
});
