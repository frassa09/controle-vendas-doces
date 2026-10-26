import { describe, expect, it } from 'vitest';
import {
  isCoreError,
  scratchAverageCost,
  type CoreError,
  type Customer,
  type Product,
  type ScratchFormat,
} from '../src';
import {
  anonymousClient,
  anonymousCore,
  newSignedInPerson,
  type TestPerson,
} from './support/members';

interface Shop {
  member: TestPerson;
  julia: Customer;
  /** R$ 3,00, pode ser prêmio. */
  brownie: Product;
  /** R$ 4,50, pode ser prêmio. */
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
async function earn(s: Shop, quantity: number): Promise<void> {
  await s.member.core.sales.recordSale({
    customerId: s.julia.id,
    items: [{ productId: s.bolo.id, quantity }],
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

const page = () => anonymousCore().customerPage;

function play(s: Shop, format: ScratchFormat = 'five_spots', pin = '4821') {
  return page().playScratch({ token: s.julia.linkToken, pin, format });
}

describe('raspadinha: configuração', () => {
  it('custo padrão 5 e chance padrão 10%; a loja configura os dois', async () => {
    const s = await shop();
    const before = await s.member.core.store.getMyStore();
    expect(before).toMatchObject({ scratchCost: 5, scratchWinPercent: 10 });
    expect((await page().getCustomerView(s.julia.linkToken)).points.scratchCost).toBe(5);

    const saved = await s.member.core.store.updateRewardSettings({
      scratchCost: 3,
      scratchWinPercent: 25,
    });
    expect(saved).toMatchObject({ redeemCost: 10, scratchCost: 3, scratchWinPercent: 25 });
    expect((await page().getCustomerView(s.julia.linkToken)).points.scratchCost).toBe(3);
  });

  it('recusa custo fora de 1 a 1000 e chance fora de 0 a 100', async () => {
    const s = await shop();
    const error = await errorOf(
      s.member.core.store.updateRewardSettings({ scratchCost: 0, scratchWinPercent: 101 }),
    );
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.fieldErrors).toEqual({
      scratchCost: 'Use um número inteiro de 1 a 1000 pontos.',
      scratchWinPercent: 'Use uma chance inteira de 0 a 100%.',
    });
    const fraction = await errorOf(
      s.member.core.store.updateRewardSettings({ scratchWinPercent: 2.5 }),
    );
    expect(fraction.fieldErrors).toEqual({
      scratchWinPercent: 'Use uma chance inteira de 0 a 100%.',
    });
  });

  it('custo médio por jogada usa o produto-prêmio ativo mais caro como pior caso', () => {
    const prizes = [
      { name: 'Brownie', priceCents: 300, canBePrize: true, isActive: true },
      { name: 'Bolo de pote', priceCents: 450, canBePrize: true, isActive: true },
      { name: 'Bolo inteiro', priceCents: 1200, canBePrize: false, isActive: true },
      { name: 'Torta', priceCents: 2000, canBePrize: true, isActive: false },
    ];
    expect(scratchAverageCost({ winPercent: 10, products: prizes })).toEqual({
      worstPrize: { name: 'Bolo de pote', priceCents: 450 },
      averageCents: 45,
    });
    expect(scratchAverageCost({ winPercent: 15, products: prizes }).averageCents).toBe(68);
    expect(scratchAverageCost({ winPercent: 10, products: [] })).toEqual({
      worstPrize: null,
      averageCents: 0,
    });
  });
});

describe('raspadinha: jogada', () => {
  it('chance 100% sempre ganha e 0% nunca, nos dois formatos, debitando o custo a cada jogada', async () => {
    const s = await shop();
    await earn(s, 8); // 40 pontos
    await s.member.core.store.updateRewardSettings({ scratchWinPercent: 100 });
    const wins = [];
    for (const format of ['five_spots', 'match_three', 'five_spots', 'match_three'] as const) {
      wins.push(await play(s, format));
    }
    expect(wins.map((r) => [r.play.format, r.play.won, r.balance])).toEqual([
      ['five_spots', true, 35],
      ['match_three', true, 30],
      ['five_spots', true, 25],
      ['match_three', true, 20],
    ]);

    await s.member.core.store.updateRewardSettings({ scratchWinPercent: 0 });
    const losses = [];
    for (const format of ['five_spots', 'match_three', 'five_spots', 'match_three'] as const) {
      losses.push(await play(s, format));
    }
    expect(losses.map((r) => [r.play.won, r.balance])).toEqual([
      [false, 15],
      [false, 10],
      [false, 5],
      [false, 0],
    ]);
  });

  it('a jogada e o débito já estão gravados quando a resposta chega', async () => {
    const s = await shop();
    await earn(s, 2); // 10 pontos
    await s.member.core.store.updateRewardSettings({ scratchCost: 4, scratchWinPercent: 0 });

    const result = await play(s, 'match_three');

    const plays = await s.member.core.scratch.listScratchPlays({ customerId: s.julia.id });
    expect(plays).toEqual([
      {
        id: result.play.id,
        customerId: s.julia.id,
        format: 'match_three',
        won: false,
        cost: 4,
        winPercent: 0,
        createdAt: result.play.createdAt,
      },
    ]);
    const points = await s.member.core.points.getCustomerPoints(s.julia.id);
    expect(points.balance).toBe(6);
    expect(points.movements[0]).toMatchObject({ kind: 'scratch', points: -4, saleId: null });
    expect((await page().getCustomerView(s.julia.linkToken)).points.balance).toBe(6);
  });

  it('saldo insuficiente é recusado sem debitar nem gravar jogada', async () => {
    const s = await shop();
    await s.member.core.store.updateRewardSettings({ scratchCost: 6 });
    await earn(s, 1); // 5 pontos

    const error = await errorOf(play(s));

    expect(error.code).toBe('INSUFFICIENT_POINTS');
    expect(error.message).toBe('Ainda não há pontos suficientes para raspar.');
    expect(await s.member.core.scratch.listScratchPlays()).toEqual([]);
    expect((await page().getCustomerView(s.julia.linkToken)).points.balance).toBe(5);
  });

  it('PIN errado é negado sem jogar e conta no mesmo limite de tentativas do resgate', async () => {
    const s = await shop();
    await earn(s, 2);
    const redeem = (pin: string) =>
      page().redeemReward({ token: s.julia.linkToken, pin, productId: s.brownie.id });

    const first = await errorOf(play(s, 'five_spots', '0000'));
    expect(first.code).toBe('PIN_INVALID');
    expect(first.fieldErrors).toEqual({ pin: 'PIN errado. Restam 4 tentativas antes da pausa.' });
    for (const pin of ['1111', '2222', '3333']) await errorOf(redeem(pin));
    const fifth = await errorOf(play(s, 'match_three', '5555'));
    expect(fifth.code).toBe('PIN_LOCKED');
    expect((await errorOf(play(s))).code).toBe('PIN_LOCKED');

    expect(await s.member.core.scratch.listScratchPlays()).toEqual([]);
    expect((await page().getCustomerView(s.julia.linkToken)).points.balance).toBe(10);
  });

  it('sem produto-prêmio ativo não deixa jogar nem cobra', async () => {
    const s = await shop();
    await earn(s, 1);
    await s.member.core.catalog.deactivateProduct(s.brownie.id);
    await s.member.core.catalog.deactivateProduct(s.pote.id);

    const error = await errorOf(play(s));

    expect(error.code).toBe('NO_PRIZES_AVAILABLE');
    expect((await page().getCustomerView(s.julia.linkToken)).points.balance).toBe(5);
  });

  it('formato desconhecido e link inexistente são recusados', async () => {
    const s = await shop();
    const bad = await errorOf(
      page().playScratch({
        token: s.julia.linkToken,
        pin: '4821',
        format: 'roleta' as ScratchFormat,
      }),
    );
    expect(bad.code).toBe('INVALID_INPUT');
    expect(bad.fieldErrors).toEqual({ format: 'Escolha um jeito de raspar.' });

    const link = await errorOf(
      page().playScratch({ token: 'f'.repeat(64), pin: '4821', format: 'five_spots' }),
    );
    expect(link.code).toBe('LINK_NOT_FOUND');
  });
});

describe('raspadinha: prêmio', () => {
  it('ganhou: escolhe um produto-prêmio e vira cupom, uma vez só por jogada', async () => {
    const s = await shop();
    await earn(s, 1); // 5 pontos
    await s.member.core.store.updateRewardSettings({ scratchWinPercent: 100 });
    const { play: won } = await play(s);

    const pending = await page().getCustomerView(s.julia.linkToken);
    expect(pending.unclaimedScratchWins).toEqual([{ playId: won.id, createdAt: won.createdAt }]);

    const claim = (productId: string, pin = '4821') =>
      page().claimScratchPrize({ token: s.julia.linkToken, pin, playId: won.id, productId });

    // Só produtos marcados como prêmio.
    expect((await errorOf(claim(s.bolo.id))).code).toBe('PRIZE_NOT_AVAILABLE');
    expect((await errorOf(claim(s.pote.id, '0000'))).code).toBe('PIN_INVALID');

    const { coupon } = await claim(s.pote.id);
    expect(coupon).toMatchObject({ productName: 'Bolo de pote', origin: 'scratch' });

    const after = await page().getCustomerView(s.julia.linkToken);
    expect(after.unclaimedScratchWins).toEqual([]);
    expect(after.coupons).toEqual([
      {
        id: coupon.id,
        productName: 'Bolo de pote',
        origin: 'scratch',
        createdAt: coupon.createdAt,
      },
    ]);
    expect(after.points.balance).toBe(0);
    const store = await s.member.core.coupons.listPendingCoupons();
    expect(store.map((c) => [c.productName, c.origin])).toEqual([['Bolo de pote', 'scratch']]);

    expect((await errorOf(claim(s.brownie.id))).code).toBe('PRIZE_ALREADY_CLAIMED');
  });

  it('jogada perdida ou de outro cliente não vira cupom', async () => {
    const s = await shop();
    await earn(s, 2);
    await s.member.core.store.updateRewardSettings({ scratchWinPercent: 0 });
    const { play: lost } = await play(s);
    await s.member.core.store.updateRewardSettings({ scratchWinPercent: 100 });
    const { play: won } = await play(s);
    const ana = await s.member.core.customers.createCustomer({
      name: 'Ana',
      whatsapp: '31 99123-4567',
      pin: '7302',
      consented: true,
    });

    const lostClaim = await errorOf(
      page().claimScratchPrize({
        token: s.julia.linkToken,
        pin: '4821',
        playId: lost.id,
        productId: s.brownie.id,
      }),
    );
    expect(lostClaim.code).toBe('SCRATCH_PLAY_NOT_FOUND');
    const stolen = await errorOf(
      page().claimScratchPrize({
        token: ana.linkToken,
        pin: '7302',
        playId: won.id,
        productId: s.brownie.id,
      }),
    );
    expect(stolen.code).toBe('SCRATCH_PLAY_NOT_FOUND');
    expect(await s.member.core.coupons.listPendingCoupons()).toEqual([]);
  });

  it('ninguém joga pelo banco nem altera uma jogada gravada', async () => {
    const s = await shop();
    await earn(s, 2);
    await s.member.core.store.updateRewardSettings({ scratchWinPercent: 0 });
    const { play: lost } = await play(s);

    const anon = anonymousClient();
    const rpc = await anon.rpc('play_scratch', {
      p_token: s.julia.linkToken,
      p_pin: '4821',
      p_format: 'five_spots',
    });
    expect(rpc.error).not.toBeNull();
    const memberRpc = await s.member.rawClient.rpc('play_scratch', {
      p_token: s.julia.linkToken,
      p_pin: '4821',
      p_format: 'five_spots',
    });
    expect(memberRpc.error).not.toBeNull();
    expect((await anon.from('scratch_plays').select('id')).data ?? []).toEqual([]);

    // Nem o membro da loja troca o resultado.
    await s.member.rawClient.from('scratch_plays').update({ won: true }).eq('id', lost.id);
    await s.member.rawClient.from('scratch_plays').delete().eq('id', lost.id);
    const plays = await s.member.core.scratch.listScratchPlays();
    expect(plays.map((p) => [p.id, p.won])).toEqual([[lost.id, false]]);
    expect((await s.member.core.points.getCustomerPoints(s.julia.id)).balance).toBe(5);
  });
});
