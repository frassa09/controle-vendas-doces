import { randomBytes } from 'node:crypto';
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
  /** R$ 3,00, 2 pontos. */
  brownie: Product;
  /** R$ 4,50, 3 pontos. */
  pote: Product;
}

async function shop(name = 'Doces da Júlia'): Promise<Shop> {
  const member = await newSignedInPerson();
  await member.core.store.createStore({
    name,
    pixKey: 'julia@example.com',
    city: 'Belo Horizonte',
  });
  const brownie = await member.core.catalog.createProduct({
    name: 'Brownie',
    priceCents: 300,
    points: 2,
  });
  const pote = await member.core.catalog.createProduct({
    name: 'Bolo de pote',
    priceCents: 450,
    points: 3,
  });
  const julia = await member.core.customers.createCustomer({
    name: 'Júlia Santos',
    whatsapp: '31 99876-5432',
    pin: '4821',
    notes: 'Gosta de brownie quentinho',
    consented: true,
  });
  return { member, julia, brownie, pote };
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

describe('página do cliente', () => {
  it('quem tem o link vê a loja, o próprio nome e o cantinho vazio, sem login', async () => {
    const { julia } = await shop();

    const view = await anonymousCore().customerPage.getCustomerView(julia.linkToken);

    expect(view).toEqual({
      store: {
        name: 'Doces da Júlia',
        brandColor: null,
        welcomeText: null,
        logoDataUrl: null,
      },
      customer: { name: 'Júlia Santos', firstName: 'Júlia' },
      points: { balance: 0, expiresAt: null, redeemCost: 10, scratchCost: 5 },
      debt: { balanceCents: 0, pendingPoints: 0, pixCode: null, openSales: [] },
      history: [],
    });
  });

  it('mostra o saldo devedor pela alocação FIFO, o Pix com o valor, os pontos e os recadinhos', async () => {
    const { member, julia, brownie, pote } = await shop();
    const fiado1 = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });
    const paga = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    const fiado2 = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: pote.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });
    // R$ 7,00 quitam a primeira venda fiado (R$ 6,00) e abatem R$ 1,00 da segunda.
    const { payment } = await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 700,
      method: 'cash',
    });

    const view = await anonymousCore().customerPage.getCustomerView(julia.linkToken);

    expect(view.points.balance).toBe(6);
    expect(view.debt).toEqual({
      balanceCents: 350,
      pendingPoints: 3,
      pixCode:
        '00020126390014br.gov.bcb.pix0117julia@example.com52040000530398654043.505802BR5914DOCES DA JULIA6014BELO HORIZONTE62070503***6304A397',
      openSales: [
        {
          saleId: fiado2.id,
          createdAt: fiado2.createdAt,
          totalCents: 450,
          remainingCents: 350,
          items: [{ name: 'Bolo de pote', quantity: 1 }],
        },
      ],
    });
    expect(view.history).toEqual([
      {
        kind: 'payment',
        id: payment.id,
        createdAt: payment.createdAt,
        status: 'active',
        amountCents: 700,
        method: 'cash',
        points: 4,
      },
      {
        kind: 'sale',
        id: fiado2.id,
        createdAt: fiado2.createdAt,
        status: 'active',
        totalCents: 450,
        paymentType: 'fiado',
        method: null,
        items: [{ name: 'Bolo de pote', quantity: 1 }],
        points: 0,
      },
      {
        kind: 'sale',
        id: paga.id,
        createdAt: paga.createdAt,
        status: 'active',
        totalCents: 300,
        paymentType: 'paidNow',
        method: 'pix',
        items: [{ name: 'Brownie', quantity: 1 }],
        points: 2,
      },
      {
        kind: 'sale',
        id: fiado1.id,
        createdAt: fiado1.createdAt,
        status: 'active',
        totalCents: 600,
        paymentType: 'fiado',
        method: null,
        items: [{ name: 'Brownie', quantity: 2 }],
        points: 0,
      },
    ]);
  });

  it('nunca expõe PIN, WhatsApp, observações, chave Pix crua nem ids da loja', async () => {
    const { julia } = await shop();

    const view = await anonymousCore().customerPage.getCustomerView(julia.linkToken);

    const text = JSON.stringify(view);
    expect(text).not.toContain('4821');
    expect(text).not.toContain('99876');
    expect(text).not.toContain('brownie quentinho');
    expect(text).not.toContain('julia@example.com');
    expect(text).not.toContain(julia.id);
  });

  it.each([
    ['um token que não existe', randomBytes(32).toString('hex')],
    ['um texto qualquer', 'nao-e-um-token'],
    ['vazio', ''],
    ['uma tentativa de injeção', "' or 1=1 --"],
  ])('link com %s dá LINK_NOT_FOUND', async (_, token) => {
    const error = await errorOf(anonymousCore().customerPage.getCustomerView(token));

    expect(error.code).toBe('LINK_NOT_FOUND');
    expect(error.message).toBe('Não encontramos este cantinho. Confira o link que a loja mandou.');
  });

  it('o token de um cliente só mostra os dados dele, mesmo com outros clientes e lojas', async () => {
    const { member, julia, brownie } = await shop();
    const pedro = await member.core.customers.createCustomer({
      name: 'Pedro',
      whatsapp: '31 91234-5678',
      pin: '1111',
      consented: true,
    });
    await member.core.sales.recordSale({
      customerId: pedro.id,
      items: [{ productId: brownie.id, quantity: 5 }],
      payment: { type: 'fiado' },
    });
    const other = await shop('Outra Doceria');
    await other.member.core.sales.recordSale({
      customerId: other.julia.id,
      items: [{ productId: other.brownie.id, quantity: 3 }],
      payment: { type: 'paidNow', method: 'cash' },
    });

    const view = await anonymousCore().customerPage.getCustomerView(julia.linkToken);
    const otherView = await anonymousCore().customerPage.getCustomerView(other.julia.linkToken);

    expect(view.store.name).toBe('Doces da Júlia');
    expect(view.history).toEqual([]);
    expect(view.debt.balanceCents).toBe(0);
    expect(otherView.store.name).toBe('Outra Doceria');
    expect(otherView.points.balance).toBe(6);
    expect(otherView.history).toHaveLength(1);
  });

  it('com a chave pública ninguém lê as tabelas nem chama a função da página direto', async () => {
    const { julia } = await shop();
    const anon = anonymousClient();

    const customers = await anon.from('customers').select('id, pin').eq('id', julia.id);
    const stores = await anon.from('stores').select('id');
    const rpc = await anon.rpc('get_customer_page', { p_token: julia.linkToken });

    expect(customers.data ?? []).toEqual([]);
    expect(stores.data ?? []).toEqual([]);
    expect(rpc.data).toBeNull();
    expect(rpc.error).not.toBeNull();
  });

  it('um membro logado também não chama a função da página direto', async () => {
    const { member, julia } = await shop();

    const rpc = await member.rawClient.rpc('get_customer_page', { p_token: julia.linkToken });

    expect(rpc.data).toBeNull();
    expect(rpc.error).not.toBeNull();
  });
});

describe('identidade da loja', () => {
  const tinyPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('cor, boas-vindas e logo escolhidos no app aparecem na página do cliente', async () => {
    const { member, julia } = await shop();

    const store = await member.core.store.updateStoreBranding({
      brandColor: '#2b8a3e',
      welcomeText: '  Que bom te ver por aqui!  ',
    });
    await member.core.store.setStoreLogo(tinyPng);
    const view = await anonymousCore().customerPage.getCustomerView(julia.linkToken);

    expect(store).toMatchObject({ brandColor: '#2B8A3E', welcomeText: 'Que bom te ver por aqui!' });
    expect(await member.core.store.getMyStore()).toEqual(store);
    expect(await member.core.store.getStoreLogo()).toBe(tinyPng);
    expect(view.store).toEqual({
      name: 'Doces da Júlia',
      brandColor: '#2B8A3E',
      welcomeText: 'Que bom te ver por aqui!',
      logoDataUrl: tinyPng,
    });
  });

  it('voltar ao padrão: sem cor, sem boas-vindas e sem logo', async () => {
    const { member, julia } = await shop();
    await member.core.store.updateStoreBranding({ brandColor: '#1971C2', welcomeText: 'Oi!' });
    await member.core.store.setStoreLogo(tinyPng);

    await member.core.store.updateStoreBranding({ brandColor: null, welcomeText: '   ' });
    await member.core.store.setStoreLogo(null);
    const view = await anonymousCore().customerPage.getCustomerView(julia.linkToken);

    expect(view.store).toMatchObject({ brandColor: null, welcomeText: null, logoDataUrl: null });
    expect(await member.core.store.getStoreLogo()).toBeNull();
  });

  it('recusa cor fora do formato e boas-vindas longas demais, apontando cada campo', async () => {
    const { member } = await shop();

    const error = await errorOf(
      member.core.store.updateStoreBranding({ brandColor: 'rosa', welcomeText: 'a'.repeat(161) }),
    );

    expect(error.code).toBe('INVALID_INPUT');
    expect(error.fieldErrors).toEqual({
      brandColor: 'Escolha uma cor no formato #RRGGBB.',
      welcomeText: 'Use no máximo 160 caracteres.',
    });
  });

  it.each([
    ['que não é imagem', 'data:text/plain;base64,aGVsbG8='],
    ['grande demais', `data:image/png;base64,${'A'.repeat(200_000)}`],
  ])('recusa logo %s', async (_, logo) => {
    const { member } = await shop();

    const error = await errorOf(member.core.store.setStoreLogo(logo));

    expect(error.code).toBe('INVALID_INPUT');
    expect(Object.keys(error.fieldErrors)).toEqual(['logo']);
    expect(await member.core.store.getStoreLogo()).toBeNull();
  });

  it('membro de outra loja não altera a identidade desta', async () => {
    const { member, julia } = await shop();
    const intruder = await newSignedInPerson();
    await intruder.core.store.createStore({
      name: 'Intrusa',
      pixKey: 'x@example.com',
      city: 'Recife',
    });
    const mine = await member.core.store.getMyStore();
    if (!mine) throw new Error('loja esperada');

    await intruder.rawClient.from('stores').update({ brand_color: '#000000' }).eq('id', mine.id);
    const view = await anonymousCore().customerPage.getCustomerView(julia.linkToken);

    expect(view.store.brandColor).toBeNull();
  });

  it('sem login não altera a identidade', async () => {
    const error = await errorOf(
      anonymousCore().store.updateStoreBranding({ brandColor: '#2B8A3E', welcomeText: null }),
    );

    expect(error.code).toBe('NOT_AUTHENTICATED');
  });
});
