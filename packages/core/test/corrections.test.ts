import { describe, expect, it } from 'vitest';
import { isCoreError, type CoreError, type Customer, type Product } from '../src';
import {
  anonymousCore,
  newSignedInPerson,
  simulatePointsSpent,
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

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('cancelar venda', () => {
  it('venda paga na hora: venda e pagamento ficam cancelados no histórico e os pontos são estornados', async () => {
    const { member, julia, brownie } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 3 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(6);

    const cancelled = await member.core.sales.cancelSale(sale.id);

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledBy?.id).toBe(member.userId);
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.totalCents).toBe(900);
    expect(cancelled.payments).toMatchObject([{ amountCents: 900, status: 'cancelled' }]);
    // Continua consultável.
    expect((await member.core.sales.getSale(sale.id)).status).toBe('cancelled');

    const balance = await member.core.payments.getCustomerBalance(julia.id);
    expect(balance.balanceCents).toBe(0);
    expect(balance.sales).toEqual([]);

    const points = await member.core.points.getCustomerPoints(julia.id);
    expect(points.balance).toBe(0);
    expect(points.movements).toMatchObject([
      { kind: 'saleReversal', points: -6, saleId: sale.id },
      { kind: 'saleCredit', points: 6, saleId: sale.id },
    ]);
  });

  it('venda fiado: sai do saldo devedor; as outras continuam', async () => {
    const { member, julia, brownie, combo } = await shop();
    const first = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });
    const second = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: combo.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });

    const cancelled = await member.core.sales.cancelSale(first.id);

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.payments).toEqual([]);
    const balance = await member.core.payments.getCustomerBalance(julia.id);
    expect(balance.balanceCents).toBe(800);
    expect(balance.sales.map((sale) => sale.saleId)).toEqual([second.id]);
    expect((await member.core.points.getCustomerPoints(julia.id)).movements).toEqual([]);
  });

  it('venda avulsa: cancela a venda e o pagamento', async () => {
    const { member, brownie } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: null,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'cash' },
    });

    const cancelled = await member.core.sales.cancelSale(sale.id);

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.payments).toMatchObject([{ amountCents: 300, status: 'cancelled' }]);
  });

  it('venda já coberta por um pagamento de dívida é recusada, sem mudar nada', async () => {
    const { member, julia, brownie } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });
    await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 600,
      method: 'pix',
    });

    const error = await errorOf(member.core.sales.cancelSale(sale.id));

    expect(error.code).toBe('PAYMENTS_EXCEED_DEBT');
    expect((await member.core.sales.getSale(sale.id)).status).toBe('active');
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(4);
  });

  it('venda fiado parcialmente paga pode ser cancelada se o pagamento cabe nas outras', async () => {
    const { member, julia, brownie, combo } = await shop();
    const first = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });
    await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: combo.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });
    // Quita a primeira (FIFO) e paga R$ 2,00 da segunda.
    await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 500,
      method: 'pix',
    });
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(2);

    await member.core.sales.cancelSale(first.id);

    // Os R$ 5,00 passam para a segunda venda.
    const balance = await member.core.payments.getCustomerBalance(julia.id);
    expect(balance.balanceCents).toBe(300);
    expect(balance.sales).toMatchObject([{ totalCents: 800, paidCents: 500, status: 'partial' }]);
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(0);
  });

  it('cancelar de novo ou venda inexistente é recusado', async () => {
    const { member, julia, brownie } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });
    await member.core.sales.cancelSale(sale.id);

    expect((await errorOf(member.core.sales.cancelSale(sale.id))).code).toBe('SALE_CANCELLED');
    expect((await errorOf(member.core.sales.cancelSale(MISSING_ID))).code).toBe('SALE_NOT_FOUND');
    expect((await errorOf(member.core.sales.cancelSale('abc'))).code).toBe('SALE_NOT_FOUND');
  });
});

describe('cancelar pagamento', () => {
  it('pagamento de dívida que tinha quitado a venda: a venda reabre e os pontos são estornados', async () => {
    const { member, julia, brownie } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });
    const { payment } = await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 600,
      method: 'pix',
    });
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(4);

    const cancelled = await member.core.payments.cancelPayment(payment.id);

    expect(cancelled).toMatchObject({
      id: payment.id,
      status: 'cancelled',
      amountCents: 600,
      customerId: julia.id,
      saleId: null,
      cancelledBy: { id: member.userId },
    });
    const balance = await member.core.payments.getCustomerBalance(julia.id);
    expect(balance.balanceCents).toBe(600);
    expect(balance.sales).toMatchObject([{ saleId: sale.id, status: 'open' }]);
    const points = await member.core.points.getCustomerPoints(julia.id);
    expect(points.balance).toBe(0);
    expect(points.movements).toMatchObject([
      { kind: 'saleReversal', points: -4, saleId: sale.id },
      { kind: 'saleCredit', points: 4 },
    ]);

    // Pagar de novo credita outra vez.
    await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 600,
      method: 'cash',
    });
    const again = await member.core.points.getCustomerPoints(julia.id);
    expect(again.balance).toBe(4);
    expect(again.movements[0]).toMatchObject({ kind: 'saleAdjustment', points: 4 });
  });

  it('pagamento da venda paga na hora: a venda vira dívida do cliente', async () => {
    const { member, julia, brownie } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    const paymentId = sale.payments[0]?.id ?? '';

    const cancelled = await member.core.payments.cancelPayment(paymentId);

    expect(cancelled).toMatchObject({ status: 'cancelled', saleId: sale.id });
    expect((await member.core.payments.getCustomerBalance(julia.id)).balanceCents).toBe(300);
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(0);
    expect((await member.core.sales.getSale(sale.id)).payments).toMatchObject([
      { status: 'cancelled' },
    ]);
  });

  it('pagamento de venda avulsa, já cancelado ou inexistente é recusado', async () => {
    const { member, julia, brownie } = await shop();
    const walkIn = await member.core.sales.recordSale({
      customerId: null,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'cash' },
    });
    expect(
      (await errorOf(member.core.payments.cancelPayment(walkIn.payments[0]?.id ?? ''))).code,
    ).toBe('WALK_IN_SALE_PAYMENT');

    await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });
    const { payment } = await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 100,
      method: 'pix',
    });
    await member.core.payments.cancelPayment(payment.id);
    expect((await errorOf(member.core.payments.cancelPayment(payment.id))).code).toBe(
      'PAYMENT_CANCELLED',
    );
    expect((await errorOf(member.core.payments.cancelPayment(MISSING_ID))).code).toBe(
      'PAYMENT_NOT_FOUND',
    );
    expect((await errorOf(member.core.payments.getPayment('x'))).code).toBe('PAYMENT_NOT_FOUND');
  });
});

describe('editar venda', () => {
  it('venda quitada que continua quitada: o pagamento acompanha o total e os pontos recebem a diferença', async () => {
    const { member, julia, brownie, combo } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(2);

    const edited = await member.core.sales.updateSale(sale.id, {
      items: [
        { productId: brownie.id, quantity: 2 },
        { productId: combo.id, quantity: 1, unitPriceCents: 750 },
      ],
    });

    expect(edited.totalCents).toBe(1350);
    expect(edited.items).toMatchObject([
      { productName: 'Brownie', quantity: 2, unitPriceCents: 300, points: 2 },
      { productName: '3 brownies', quantity: 1, unitPriceCents: 750, points: 7 },
    ]);
    expect(edited.editedAt).not.toBeNull();
    expect(edited.payments).toMatchObject([
      { amountCents: 300, method: 'pix', status: 'cancelled' },
      { amountCents: 1350, method: 'pix', status: 'active' },
    ]);
    expect((await member.core.payments.getCustomerBalance(julia.id)).balanceCents).toBe(0);

    const points = await member.core.points.getCustomerPoints(julia.id);
    expect(points.balance).toBe(11);
    expect(points.movements).toMatchObject([
      { kind: 'saleAdjustment', points: 9, saleId: sale.id },
      { kind: 'saleCredit', points: 2, saleId: sale.id },
    ]);

    // Diminuir também recalcula a diferença.
    await member.core.sales.updateSale(sale.id, { items: [{ productId: combo.id, quantity: 1 }] });
    const after = await member.core.points.getCustomerPoints(julia.id);
    expect(after.balance).toBe(7);
    expect(after.movements[0]).toMatchObject({ kind: 'saleAdjustment', points: -4 });
  });

  it('cada edição guarda a versão anterior dos itens, com quem a substituiu', async () => {
    const { member, julia, brownie, combo } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1, unitPriceCents: 250 }],
      payment: { type: 'fiado' },
    });
    expect(sale.previousVersions).toEqual([]);

    await member.core.sales.updateSale(sale.id, {
      items: [
        { productId: brownie.id, quantity: 2 },
        { productId: combo.id, quantity: 1 },
      ],
    });
    const edited = await member.core.sales.updateSale(sale.id, {
      items: [{ productId: combo.id, quantity: 3 }],
    });

    expect(edited.totalCents).toBe(2400);
    expect(edited.previousVersions).toMatchObject([
      {
        revision: 2,
        replacedBy: { id: member.userId },
        totalCents: 1300,
        items: [
          {
            productId: brownie.id,
            productName: 'Brownie',
            quantity: 2,
            unitPriceCents: 250,
            points: 2,
          },
          {
            productId: combo.id,
            productName: '3 brownies',
            quantity: 1,
            unitPriceCents: 800,
            points: 7,
          },
        ],
      },
      {
        revision: 1,
        replacedBy: { id: member.userId },
        totalCents: 250,
        items: [{ productName: 'Brownie', quantity: 1, unitPriceCents: 250, points: 2 }],
      },
    ]);
    expect(edited.previousVersions[1]?.items).toHaveLength(1);
    expect(edited.previousVersions[0]?.replacedAt).toEqual(expect.any(String));
  });

  it('venda fiado quitada que passa a valer mais volta a ficar em aberto e estorna os pontos', async () => {
    const { member, julia, brownie } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });
    await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 300,
      method: 'pix',
    });

    await member.core.sales.updateSale(sale.id, {
      items: [{ productId: brownie.id, quantity: 2 }],
    });

    const balance = await member.core.payments.getCustomerBalance(julia.id);
    expect(balance.balanceCents).toBe(300);
    expect(balance.sales).toMatchObject([{ totalCents: 600, paidCents: 300, status: 'partial' }]);
    const points = await member.core.points.getCustomerPoints(julia.id);
    expect(points.balance).toBe(0);
    expect(points.movements[0]).toMatchObject({ kind: 'saleReversal', points: -2 });
  });

  it('itens que já estavam na venda mantêm o nome, o preço e os pontos da época', async () => {
    const { member, julia, brownie } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });
    await member.core.catalog.updateProduct(brownie.id, {
      name: 'Brownie grande',
      priceCents: 500,
      points: 5,
    });
    await member.core.catalog.deactivateProduct(brownie.id);

    const edited = await member.core.sales.updateSale(sale.id, {
      items: [{ productId: brownie.id, quantity: 3 }],
    });

    expect(edited.items).toMatchObject([
      { productName: 'Brownie', quantity: 3, unitPriceCents: 300, points: 2 },
    ]);
    expect(edited.totalCents).toBe(900);
  });

  it('produto novo desativado, venda cancelada ou inexistente é recusado', async () => {
    const { member, julia, brownie, combo } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });
    await member.core.catalog.deactivateProduct(combo.id);

    const inactive = await errorOf(
      member.core.sales.updateSale(sale.id, {
        items: [
          { productId: brownie.id, quantity: 1 },
          { productId: combo.id, quantity: 1 },
        ],
      }),
    );
    expect(inactive.code).toBe('PRODUCT_INACTIVE');

    const empty = await errorOf(member.core.sales.updateSale(sale.id, { items: [] }));
    expect(empty.code).toBe('INVALID_INPUT');
    expect(empty.fieldErrors).toHaveProperty('items');

    expect(
      (
        await errorOf(
          member.core.sales.updateSale(MISSING_ID, {
            items: [{ productId: brownie.id, quantity: 1 }],
          }),
        )
      ).code,
    ).toBe('SALE_NOT_FOUND');

    await member.core.sales.cancelSale(sale.id);
    expect(
      (
        await errorOf(
          member.core.sales.updateSale(sale.id, {
            items: [{ productId: brownie.id, quantity: 2 }],
          }),
        )
      ).code,
    ).toBe('SALE_CANCELLED');
  });

  it('baixar o total abaixo do que o cliente já pagou em dívida é recusado', async () => {
    const { member, julia, brownie } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });
    await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 500,
      method: 'pix',
    });

    const error = await errorOf(
      member.core.sales.updateSale(sale.id, { items: [{ productId: brownie.id, quantity: 1 }] }),
    );

    expect(error.code).toBe('PAYMENTS_EXCEED_DEBT');
    expect((await member.core.sales.getSale(sale.id)).totalCents).toBe(600);
  });
});

describe('estorno com saldo de pontos já gasto', () => {
  it('o saldo fica negativo e os próximos créditos abatem a diferença', async () => {
    const { member, julia, brownie, combo } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 3 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    const store = await member.core.store.getMyStore();
    await simulatePointsSpent(store?.id ?? '', julia.id, 6);
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(0);

    await member.core.sales.cancelSale(sale.id);
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(-6);

    await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: combo.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'cash' },
    });
    expect((await member.core.points.getCustomerPoints(julia.id)).balance).toBe(1);
  });
});

describe('histórico do cliente', () => {
  it('mostra compras e pagamentos de dívida, inclusive os cancelados, do mais novo ao mais antigo', async () => {
    const { member, julia, brownie, combo } = await shop();
    const first = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });
    const { payment } = await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 300,
      method: 'pix',
    });
    const second = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: combo.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'cash' },
    });
    await member.core.sales.cancelSale(second.id);

    const history = await member.core.sales.listCustomerHistory(julia.id);

    expect(history).toMatchObject([
      { type: 'sale', id: second.id, totalCents: 800, status: 'cancelled', paymentType: 'paidNow' },
      { type: 'payment', id: payment.id, amountCents: 300, method: 'pix', status: 'active' },
      { type: 'sale', id: first.id, totalCents: 300, status: 'active', paymentType: 'fiado' },
    ]);
    expect(history).toHaveLength(3);
  });
});

describe('isolamento das correções', () => {
  it('outra loja não cancela nem edita, e sem login nada acontece', async () => {
    const { member, julia, brownie } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    const paymentId = sale.payments[0]?.id ?? '';
    const stranger = await newSignedInPerson();
    await stranger.core.store.createStore({
      name: 'Outra loja',
      pixKey: 'outra@example.com',
      city: 'Recife',
    });

    expect((await errorOf(stranger.core.sales.cancelSale(sale.id))).code).toBe('SALE_NOT_FOUND');
    expect(
      (
        await errorOf(
          stranger.core.sales.updateSale(sale.id, {
            items: [{ productId: brownie.id, quantity: 9 }],
          }),
        )
      ).code,
    ).toBe('SALE_NOT_FOUND');
    expect((await errorOf(stranger.core.payments.cancelPayment(paymentId))).code).toBe(
      'PAYMENT_NOT_FOUND',
    );
    expect((await errorOf(stranger.core.sales.listCustomerHistory(julia.id))).code).toBe(
      'CUSTOMER_NOT_FOUND',
    );
    // Direto pela API, sem o core.
    const raw = await stranger.rawClient.rpc('cancel_sale', { p_sale_id: sale.id });
    expect(raw.error).not.toBeNull();

    const anonymous = anonymousCore();
    expect((await errorOf(anonymous.sales.cancelSale(sale.id))).code).toBe('NOT_AUTHENTICATED');
    expect((await errorOf(anonymous.payments.cancelPayment(paymentId))).code).toBe(
      'NOT_AUTHENTICATED',
    );

    const untouched = await member.core.sales.getSale(sale.id);
    expect(untouched.status).toBe('active');
    expect(untouched.payments).toMatchObject([{ status: 'active' }]);
  });
});
