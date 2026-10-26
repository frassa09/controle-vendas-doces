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
  /** R$ 3,00, 2 pontos, pode ser prêmio. */
  brownie: Product;
  /** R$ 4,50, 3 pontos, pode ser prêmio. */
  pote: Product;
  /** R$ 12,00, 5 pontos, não é prêmio. */
  bolo: Product;
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
    canBePrize: true,
  });
  const pote = await member.core.catalog.createProduct({
    name: 'Bolo de pote',
    priceCents: 450,
    points: 3,
    canBePrize: true,
  });
  const bolo = await member.core.catalog.createProduct({
    name: 'Bolo inteiro',
    priceCents: 1200,
    points: 5,
  });
  const julia = await member.core.customers.createCustomer({
    name: 'Júlia Santos',
    whatsapp: '31 99876-5432',
    pin: '4821',
    consented: true,
  });
  return { member, julia, brownie, pote, bolo };
}

/** Compra paga na hora que dá `quantity` × 5 pontos à cliente. */
async function earn(shop: Shop, quantity: number): Promise<void> {
  await shop.member.core.sales.recordSale({
    customerId: shop.julia.id,
    items: [{ productId: shop.bolo.id, quantity }],
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

describe('resgate direto', () => {
  it('troca 10 pontos por um prêmio: debita o livro e cria o cupom pendente', async () => {
    const s = await shop();
    await earn(s, 3); // 15 pontos
    const page = anonymousCore().customerPage;

    const result = await page.redeemReward({
      token: s.julia.linkToken,
      pin: '4821',
      productId: s.brownie.id,
    });

    expect(result.balance).toBe(5);
    expect(result.coupon).toMatchObject({ productName: 'Brownie', origin: 'redemption' });

    const points = await s.member.core.points.getCustomerPoints(s.julia.id);
    expect(points.balance).toBe(5);
    expect(points.movements[0]).toMatchObject({ kind: 'redemption', points: -10, saleId: null });

    const view = await page.getCustomerView(s.julia.linkToken);
    expect(view.points.balance).toBe(5);
    expect(view.coupons).toEqual([
      {
        id: result.coupon.id,
        productName: 'Brownie',
        origin: 'redemption',
        createdAt: result.coupon.createdAt,
      },
    ]);
  });

  it('a página lista só os produtos ativos marcados como prêmio, por nome', async () => {
    const s = await shop();
    const view = await anonymousCore().customerPage.getCustomerView(s.julia.linkToken);
    expect(view.prizes).toEqual([
      { id: s.pote.id, name: 'Bolo de pote' },
      { id: s.brownie.id, name: 'Brownie' },
    ]);

    await s.member.core.catalog.deactivateProduct(s.pote.id);
    const after = await anonymousCore().customerPage.getCustomerView(s.julia.linkToken);
    expect(after.prizes).toEqual([{ id: s.brownie.id, name: 'Brownie' }]);
  });

  it('usa o custo de resgate configurado pela loja', async () => {
    const s = await shop();
    const store = await s.member.core.store.updateRewardSettings({ redeemCost: 4 });
    expect(store.redeemCost).toBe(4);
    await earn(s, 1); // 5 pontos
    const page = anonymousCore().customerPage;

    expect((await page.getCustomerView(s.julia.linkToken)).points.redeemCost).toBe(4);
    const result = await page.redeemReward({
      token: s.julia.linkToken,
      pin: '4821',
      productId: s.pote.id,
    });
    expect(result.balance).toBe(1);
  });

  it('o custo padrão é 10 e só aceita inteiros de 1 a 1000', async () => {
    const s = await shop();
    expect((await s.member.core.store.getMyStore())?.redeemCost).toBe(10);

    for (const redeemCost of [0, 1001, 2.5]) {
      const error = await errorOf(s.member.core.store.updateRewardSettings({ redeemCost }));
      expect(error.code).toBe('INVALID_INPUT');
      expect(error.fieldErrors).toEqual({
        redeemCost: 'Use um número inteiro de 1 a 1000 pontos.',
      });
    }
  });

  it('recusa a troca sem pontos suficientes, sem debitar nem criar cupom', async () => {
    const s = await shop();
    await earn(s, 1); // 5 pontos
    const page = anonymousCore().customerPage;

    const error = await errorOf(
      page.redeemReward({ token: s.julia.linkToken, pin: '4821', productId: s.brownie.id }),
    );

    expect(error.code).toBe('INSUFFICIENT_POINTS');
    const view = await page.getCustomerView(s.julia.linkToken);
    expect(view.points.balance).toBe(5);
    expect(view.coupons).toEqual([]);
  });

  it('só aceita produto ativo, marcado como prêmio e da mesma loja', async () => {
    const s = await shop();
    const other = await shop();
    await earn(s, 2);
    await s.member.core.catalog.deactivateProduct(s.pote.id);
    const page = anonymousCore().customerPage;
    const redeem = (productId: string) =>
      errorOf(page.redeemReward({ token: s.julia.linkToken, pin: '4821', productId }));

    expect((await redeem(s.bolo.id)).code).toBe('PRIZE_NOT_AVAILABLE');
    expect((await redeem(s.pote.id)).code).toBe('PRIZE_NOT_AVAILABLE');
    expect((await redeem(other.brownie.id)).code).toBe('PRIZE_NOT_AVAILABLE');
    expect((await redeem('nao-e-um-id')).code).toBe('PRIZE_NOT_AVAILABLE');
    expect((await page.getCustomerView(s.julia.linkToken)).points.balance).toBe(10);
  });

  it('PIN errado é negado, não debita e diz quantas tentativas restam', async () => {
    const s = await shop();
    await earn(s, 2);
    const page = anonymousCore().customerPage;

    const error = await errorOf(
      page.redeemReward({ token: s.julia.linkToken, pin: '1111', productId: s.brownie.id }),
    );

    expect(error.code).toBe('PIN_INVALID');
    expect(error.fieldErrors).toEqual({
      pin: 'PIN errado. Você tem mais 4 tentativas antes de uma pausa.',
    });
    const view = await page.getCustomerView(s.julia.linkToken);
    expect(view.points.balance).toBe(10);
    expect(view.coupons).toEqual([]);
  });

  it('PIN fora do formato é recusado antes de ir ao servidor', async () => {
    const s = await shop();
    const error = await errorOf(
      anonymousCore().customerPage.redeemReward({
        token: s.julia.linkToken,
        pin: '12a',
        productId: s.brownie.id,
      }),
    );
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.fieldErrors).toEqual({ pin: 'Digite os 4 números do PIN.' });
  });

  it('link inexistente é LINK_NOT_FOUND', async () => {
    const s = await shop();
    const error = await errorOf(
      anonymousCore().customerPage.redeemReward({
        token: 'f'.repeat(64),
        pin: '4821',
        productId: s.brownie.id,
      }),
    );
    expect(error.code).toBe('LINK_NOT_FOUND');
  });

  it('bloqueia depois de 5 PINs errados seguidos, até para o PIN certo', async () => {
    const s = await shop();
    await earn(s, 2);
    const page = anonymousCore().customerPage;
    const attempt = (pin: string) =>
      errorOf(page.redeemReward({ token: s.julia.linkToken, pin, productId: s.brownie.id }));

    const messages: (string | undefined)[] = [];
    for (const pin of ['0000', '1111', '2222', '3333']) {
      messages.push((await attempt(pin)).fieldErrors.pin);
    }
    expect(messages).toEqual([
      'PIN errado. Você tem mais 4 tentativas antes de uma pausa.',
      'PIN errado. Você tem mais 3 tentativas antes de uma pausa.',
      'PIN errado. Você tem mais 2 tentativas antes de uma pausa.',
      'PIN errado. Você tem mais 1 tentativa antes de uma pausa.',
    ]);

    const fifth = await attempt('5555');
    expect(fifth.code).toBe('PIN_LOCKED');
    expect(fifth.message).toBe(
      'Muitas tentativas com o PIN errado. Tente de novo daqui a 15 minutos.',
    );

    const right = await attempt('4821');
    expect(right.code).toBe('PIN_LOCKED');
    expect((await page.getCustomerView(s.julia.linkToken)).points.balance).toBe(10);
  });

  it('acertar o PIN zera as falhas; o bloqueio é por cliente', async () => {
    const s = await shop();
    await earn(s, 4); // 20 pontos
    const ana = await s.member.core.customers.createCustomer({
      name: 'Ana',
      whatsapp: '31 99123-4567',
      pin: '7302',
      consented: true,
    });
    const page = anonymousCore().customerPage;
    const julia = (pin: string) =>
      page.redeemReward({ token: s.julia.linkToken, pin, productId: s.brownie.id });

    for (const pin of ['0000', '1111', '2222', '3333']) await errorOf(julia(pin));
    // A Ana erra no meio: não conta para a Júlia.
    await errorOf(
      page.redeemReward({ token: ana.linkToken, pin: '0000', productId: s.brownie.id }),
    );
    await julia('4821');

    const again = await errorOf(julia('0000'));
    expect(again.fieldErrors.pin).toBe(
      'PIN errado. Você tem mais 4 tentativas antes de uma pausa.',
    );
  });

  it('ninguém chama o resgate direto no banco nem lê cupons com a chave pública', async () => {
    const s = await shop();
    await earn(s, 2);
    const anon = anonymousClient();

    const rpc = await anon.rpc('redeem_reward', {
      p_token: s.julia.linkToken,
      p_pin: '4821',
      p_product_id: s.brownie.id,
    });
    expect(rpc.error).not.toBeNull();
    const coupons = await anon.from('coupons').select('id');
    expect(coupons.data ?? []).toEqual([]);
    expect((await s.member.core.points.getCustomerPoints(s.julia.id)).balance).toBe(10);
  });
});

describe('cupons', () => {
  it('lista os pendentes da loja e do cliente e dá baixa com quem entregou e quando', async () => {
    const s = await shop();
    await earn(s, 4); // 20 pontos
    const ana = await s.member.core.customers.createCustomer({
      name: 'Ana',
      whatsapp: '31 99123-4567',
      pin: '7302',
      consented: true,
    });
    await s.member.core.sales.recordSale({
      customerId: ana.id,
      items: [{ productId: s.bolo.id, quantity: 2 }],
      payment: { type: 'paidNow', method: 'cash' },
    });
    const page = anonymousCore().customerPage;
    const first = await page.redeemReward({
      token: s.julia.linkToken,
      pin: '4821',
      productId: s.brownie.id,
    });
    const second = await page.redeemReward({
      token: ana.linkToken,
      pin: '7302',
      productId: s.pote.id,
    });

    const store = await s.member.core.coupons.listPendingCoupons();
    expect(store.map((c) => [c.customer.name, c.productName])).toEqual([
      ['Júlia Santos', 'Brownie'],
      ['Ana', 'Bolo de pote'],
    ]);
    const julias = await s.member.core.coupons.listPendingCoupons({ customerId: s.julia.id });
    expect(julias).toEqual([
      {
        id: first.coupon.id,
        customer: { id: s.julia.id, name: 'Júlia Santos' },
        productId: s.brownie.id,
        productName: 'Brownie',
        origin: 'redemption',
        status: 'pending',
        createdAt: first.coupon.createdAt,
        deliveredAt: null,
        deliveredBy: null,
      },
    ]);

    const delivered = await s.member.core.coupons.deliverCoupon(second.coupon.id);
    expect(delivered).toMatchObject({
      id: second.coupon.id,
      status: 'delivered',
      deliveredBy: { id: s.member.userId, email: s.member.email },
    });
    expect(delivered.deliveredAt).not.toBeNull();

    expect((await s.member.core.coupons.listPendingCoupons()).map((c) => c.id)).toEqual([
      first.coupon.id,
    ]);
    expect((await page.getCustomerView(ana.linkToken)).coupons).toEqual([]);

    const twice = await errorOf(s.member.core.coupons.deliverCoupon(second.coupon.id));
    expect(twice.code).toBe('COUPON_ALREADY_DELIVERED');
  });

  it('cupom de outra loja não aparece nem pode ser entregue', async () => {
    const s = await shop();
    const other = await shop();
    await earn(s, 2);
    const { coupon } = await anonymousCore().customerPage.redeemReward({
      token: s.julia.linkToken,
      pin: '4821',
      productId: s.brownie.id,
    });

    expect(await other.member.core.coupons.listPendingCoupons()).toEqual([]);
    const error = await errorOf(other.member.core.coupons.deliverCoupon(coupon.id));
    expect(error.code).toBe('COUPON_NOT_FOUND');
    expect((await s.member.core.coupons.listPendingCoupons()).map((c) => c.id)).toEqual([
      coupon.id,
    ]);
  });
});
