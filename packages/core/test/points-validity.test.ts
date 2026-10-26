import { describe, expect, it } from 'vitest';
import { isCoreError, type CoreError, type Customer, type Product } from '../src';
import {
  ageCustomerPoints,
  anonymousCore,
  newSignedInPerson,
  type TestPerson,
} from './support/members';

interface Shop {
  member: TestPerson;
  julia: Customer;
  /** R$ 3,00, 2 pontos por unidade. */
  brownie: Product;
}

async function shop(validityDays: number | null): Promise<Shop> {
  const member = await newSignedInPerson();
  await member.core.store.createStore({
    name: 'Doces da Júlia',
    pixKey: 'julia@example.com',
    city: 'Belo Horizonte',
  });
  if (validityDays !== null) await member.core.store.updatePointsValidity(validityDays);
  const brownie = await member.core.catalog.createProduct({
    name: 'Brownie',
    priceCents: 300,
    points: 2,
  });
  const julia = await member.core.customers.createCustomer({
    name: 'Júlia',
    whatsapp: '31 99876-5432',
    pin: '4821',
    consented: true,
  });
  return { member, julia, brownie };
}

async function buy(s: Shop, quantity: number): Promise<void> {
  await s.member.core.sales.recordSale({
    customerId: s.julia.id,
    items: [{ productId: s.brownie.id, quantity }],
    payment: { type: 'paidNow', method: 'pix' },
  });
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

const DAY = 86_400_000;

describe('validade dos pontos', () => {
  it('sem validade os pontos nunca vencem e não há data de vencimento', async () => {
    const s = await shop(null);
    await buy(s, 3);
    await ageCustomerPoints(s.julia.id, 3000);

    const points = await s.member.core.points.getCustomerPoints(s.julia.id);
    expect(points.balance).toBe(6);
    expect(points.expiresAt).toBeNull();
    expect(points.movements).toHaveLength(1);
    expect((await s.member.core.store.getMyStore())?.pointsValidityDays).toBeNull();
  });

  it('expõe a data de vencimento: última compra paga + N dias', async () => {
    const s = await shop(30);
    await buy(s, 3);

    const points = await s.member.core.points.getCustomerPoints(s.julia.id);
    const credit = points.movements[0];
    expect(points.balance).toBe(6);
    expect(credit?.kind).toBe('saleCredit');
    const expected = new Date(credit?.createdAt ?? '').getTime() + 30 * DAY;
    expect(new Date(points.expiresAt ?? '').getTime()).toBe(expected);
  });

  it('antes do prazo nada vence; depois do prazo o saldo todo vira um movimento vencido', async () => {
    const s = await shop(30);
    await buy(s, 3);

    await ageCustomerPoints(s.julia.id, 29);
    const before = await s.member.core.points.getCustomerPoints(s.julia.id);
    expect(before.balance).toBe(6);
    expect(before.movements).toHaveLength(1);

    await ageCustomerPoints(s.julia.id, 2);
    const after = await s.member.core.points.getCustomerPoints(s.julia.id);
    expect(after.balance).toBe(0);
    expect(after.expiresAt).toBeNull();
    expect(after.movements).toHaveLength(2);
    expect(after.movements[0]).toMatchObject({ kind: 'expiration', points: -6, saleId: null });
  });

  it('o vencimento é idempotente: ler de novo não vence em dobro', async () => {
    const s = await shop(30);
    await buy(s, 3);
    await ageCustomerPoints(s.julia.id, 40);

    await s.member.core.points.getCustomerPoints(s.julia.id);
    const again = await s.member.core.points.getCustomerPoints(s.julia.id);
    const [a, b] = await Promise.all([
      s.member.core.points.getCustomerPoints(s.julia.id),
      s.member.core.points.getCustomerPoints(s.julia.id),
    ]);

    for (const read of [again, a, b]) {
      expect(read.balance).toBe(0);
      expect(read.movements.filter((m) => m.kind === 'expiration')).toHaveLength(1);
    }
  });

  it('compra paga renova o prazo de todo o saldo', async () => {
    const s = await shop(30);
    await buy(s, 3); // 6 pontos
    await ageCustomerPoints(s.julia.id, 20);
    await buy(s, 1); // +2 pontos, o prazo recomeça agora
    await ageCustomerPoints(s.julia.id, 20); // 1ª compra com 40 dias, 2ª com 20

    const points = await s.member.core.points.getCustomerPoints(s.julia.id);
    expect(points.balance).toBe(8);
    expect(points.movements.some((m) => m.kind === 'expiration')).toBe(false);

    await ageCustomerPoints(s.julia.id, 15); // 2ª compra com 35 dias
    const expired = await s.member.core.points.getCustomerPoints(s.julia.id);
    expect(expired.balance).toBe(0);
    expect(expired.movements[0]).toMatchObject({ kind: 'expiration', points: -8 });
  });

  it('compra depois do vencimento começa pontos novos com prazo novo', async () => {
    const s = await shop(30);
    await buy(s, 3);
    await ageCustomerPoints(s.julia.id, 40);
    expect((await s.member.core.points.getCustomerPoints(s.julia.id)).balance).toBe(0);

    await buy(s, 2);
    const points = await s.member.core.points.getCustomerPoints(s.julia.id);
    expect(points.balance).toBe(4);
    expect(points.expiresAt).not.toBeNull();
  });

  it('a página do cliente mostra até quando os pontos valem e vence o saldo ao abrir', async () => {
    const s = await shop(30);
    await buy(s, 3);

    const view = await anonymousCore().customerPage.getCustomerView(s.julia.linkToken);
    expect(view.points.balance).toBe(6);
    const credit = (await s.member.core.points.getCustomerPoints(s.julia.id)).movements[0];
    expect(new Date(view.points.expiresAt ?? '').getTime()).toBe(
      new Date(credit?.createdAt ?? '').getTime() + 30 * DAY,
    );

    await ageCustomerPoints(s.julia.id, 40);
    const expired = await anonymousCore().customerPage.getCustomerView(s.julia.linkToken);
    expect(expired.points.balance).toBe(0);
    expect(expired.points.expiresAt).toBeNull();
  });

  it('a página sem validade não traz data', async () => {
    const s = await shop(null);
    await buy(s, 3);
    const view = await anonymousCore().customerPage.getCustomerView(s.julia.linkToken);
    expect(view.points.expiresAt).toBeNull();
  });

  it('configuração: volta a sem validade com null e recusa valores inválidos', async () => {
    const { member } = await shop(30);
    expect((await member.core.store.getMyStore())?.pointsValidityDays).toBe(30);

    for (const bad of [0, -5, 1.5, 3651, Number.NaN]) {
      const error = await errorOf(member.core.store.updatePointsValidity(bad));
      expect(error.code).toBe('INVALID_INPUT');
      expect(error.fieldErrors).toHaveProperty('pointsValidityDays');
    }
    expect((await member.core.store.getMyStore())?.pointsValidityDays).toBe(30);

    const store = await member.core.store.updatePointsValidity(null);
    expect(store.pointsValidityDays).toBeNull();
  });

  it('quem é de outra loja não lê o cliente', async () => {
    const s = await shop(30);
    const stranger = await newSignedInPerson();
    await stranger.core.store.createStore({
      name: 'Outra loja',
      pixKey: 'outra@example.com',
      city: 'Recife',
    });
    const error = await errorOf(stranger.core.points.getCustomerPoints(s.julia.id));
    expect(error.code).toBe('CUSTOMER_NOT_FOUND');
  });
});
