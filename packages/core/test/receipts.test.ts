import { describe, expect, it } from 'vitest';
import { createCore, isCoreError, type CoreError, type Customer, type Product } from '../src';
import { anonymousCore, newSignedInPerson, type TestPerson } from './support/members';

const PAGE = 'https://cantinho.example/';

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
  /** Com o endereço da página configurado. */
  core: ReturnType<typeof createCore>;
  julia: Customer;
  /** R$ 3,00, 2 pontos. */
  brownie: Product;
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
  const julia = await member.core.customers.createCustomer({
    name: 'Júlia',
    whatsapp: '31 99876-5432',
    pin: '4821',
    consented: true,
  });
  const core = createCore({ supabase: member.rawClient, customerPageUrl: PAGE });
  return { member, core, julia, brownie };
}

async function fiado(member: TestPerson, customerId: string, productId: string, quantity: number) {
  await member.core.sales.recordSale({
    customerId,
    items: [{ productId, quantity }],
    payment: { type: 'fiado' },
  });
}

describe('recibo de pagamento', () => {
  it('pagamento parcial rende 0 pontos; o que quita a venda rende os pontos dela', async () => {
    const { member, core, julia, brownie } = await shop();
    // R$ 6,00 fiado: os 4 pontos só chegam quando quitada.
    await fiado(member, julia.id, brownie.id, 2);

    const partial = await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 200,
      method: 'pix',
    });
    const first = await core.receipts.buildPaymentReceipt(partial.payment.id);
    expect(first.pointsEarned).toBe(0);
    expect(first.pointsBalance).toBe(0);
    expect(first.balanceCents).toBe(400);
    expect(first.text).toBe(
      [
        'Oi, Júlia! Recebi o seu pagamento de R$ 2,00. Muito obrigada!',
        '',
        'Ainda ficou faltando R$ 4,00, sem pressa.',
        '',
        'Pontos ganhos agora: 0 pontos',
        'Seu saldo: 0 pontos',
        '',
        `Seu cantinho, com tudo direitinho: https://cantinho.example/c/${julia.linkToken}`,
      ].join('\n'),
    );
    expect(first.whatsappUrl).toBe(
      `https://wa.me/5531998765432?text=${encodeURIComponent(first.text)}`,
    );

    const rest = await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 400,
      method: 'cash',
    });
    const second = await core.receipts.buildPaymentReceipt(rest.payment.id);
    expect(second.pointsEarned).toBe(4);
    expect(second.pointsBalance).toBe(4);
    expect(second.balanceCents).toBe(0);
    expect(second.text).toBe(
      [
        'Oi, Júlia! Recebi o seu pagamento de R$ 4,00. Muito obrigada!',
        '',
        'Sua conta está quitada.',
        '',
        'Pontos ganhos agora: 4 pontos',
        'Seu saldo: 4 pontos',
        '',
        `Seu cantinho, com tudo direitinho: https://cantinho.example/c/${julia.linkToken}`,
      ].join('\n'),
    );

    // O recibo antigo continua mostrando o que o pagamento rendeu na época.
    expect((await core.receipts.buildPaymentReceipt(partial.payment.id)).pointsEarned).toBe(0);
  });

  it('sem endereço da página a linha do link some; cancelado, alheio ou inválido é recusado', async () => {
    const { member, julia, brownie } = await shop();
    await fiado(member, julia.id, brownie.id, 1);
    const { payment } = await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 300,
      method: 'pix',
    });

    const receipt = await member.core.receipts.buildPaymentReceipt(payment.id);
    expect(receipt.text).not.toContain('http');
    expect(receipt.text).toContain('Pontos ganhos agora: 2 pontos');

    const stranger = await newSignedInPerson();
    await stranger.core.store.createStore({ name: 'Outra', pixKey: 'o@example.com', city: 'BH' });
    expect((await errorOf(stranger.core.receipts.buildPaymentReceipt(payment.id))).code).toBe(
      'PAYMENT_NOT_FOUND',
    );

    await member.core.payments.cancelPayment(payment.id);
    expect((await errorOf(member.core.receipts.buildPaymentReceipt(payment.id))).code).toBe(
      'PAYMENT_CANCELLED',
    );
    expect((await errorOf(member.core.receipts.buildPaymentReceipt('abc'))).code).toBe(
      'PAYMENT_NOT_FOUND',
    );
  });

  it('sem login, nada é gerado', async () => {
    const { member, julia, brownie } = await shop();
    await fiado(member, julia.id, brownie.id, 1);
    const { payment } = await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 100,
      method: 'pix',
    });
    const anon = anonymousCore();
    expect((await errorOf(anon.receipts.buildPaymentReceipt(payment.id))).code).toBe(
      'NOT_AUTHENTICATED',
    );
    expect((await errorOf(anon.receipts.buildAccessMessage(julia.id))).code).toBe(
      'NOT_AUTHENTICATED',
    );
  });
});

describe('reenvio de link e PIN', () => {
  it('traz o link da página e o PIN, e abre o WhatsApp do cliente', async () => {
    const { core, julia } = await shop();

    const message = await core.receipts.buildAccessMessage(julia.id);
    expect(message.customerName).toBe('Júlia');
    expect(message.text).toBe(
      [
        'Oi, Júlia! Aqui está o seu acesso ao cantinho:',
        '',
        `Link: https://cantinho.example/c/${julia.linkToken}`,
        'PIN: 4821',
        '',
        'Guarde com carinho e não passe para ninguém.',
      ].join('\n'),
    );
    expect(message.whatsappUrl).toBe(
      `https://wa.me/5531998765432?text=${encodeURIComponent(message.text)}`,
    );
  });

  it('reflete o PIN editado; cliente de outra loja ou inexistente é recusado', async () => {
    const { member, julia } = await shop();
    await member.core.customers.updateCustomer(julia.id, {
      name: 'Júlia',
      whatsapp: '31 99876-5432',
      pin: '7305',
      consented: true,
    });
    expect((await member.core.receipts.buildAccessMessage(julia.id)).text).toContain('PIN: 7305');

    const stranger = await newSignedInPerson();
    await stranger.core.store.createStore({ name: 'Outra', pixKey: 'o@example.com', city: 'BH' });
    expect((await errorOf(stranger.core.receipts.buildAccessMessage(julia.id))).code).toBe(
      'CUSTOMER_NOT_FOUND',
    );
    expect((await errorOf(member.core.receipts.buildAccessMessage('abc'))).code).toBe(
      'CUSTOMER_NOT_FOUND',
    );
  });
});
