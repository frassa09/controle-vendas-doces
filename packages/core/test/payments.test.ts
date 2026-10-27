import { beforeAll, describe, expect, it } from 'vitest';
import {
  isCoreError,
  type CoreError,
  type Customer,
  type Product,
  type RecordPaymentInput,
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
  brownie: Product;
}

/** Uma loja com um cliente e um brownie de R$ 3,00. */
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
    points: 1,
  });
  const julia = await member.core.customers.createCustomer({
    name: 'Júlia',
    whatsapp: '31 99876-5432',
    pin: '4821',
    consented: true,
  });
  return { member, julia, brownie };
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

describe('venda fiado', () => {
  it('fica sem pagamento e entra no saldo devedor do cliente', async () => {
    const { member, julia, brownie } = await shop();

    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });

    expect(sale).toMatchObject({ paymentType: 'fiado', totalCents: 600, payments: [] });
    const balance = await member.core.payments.getCustomerBalance(julia.id);
    expect(balance).toMatchObject({
      customerId: julia.id,
      balanceCents: 600,
      debtSince: sale.createdAt,
      sales: [
        { saleId: sale.id, totalCents: 600, paidCents: 0, remainingCents: 600, status: 'open' },
      ],
    });
  });

  it('venda avulsa não pode ser fiado, nem chamando o banco direto', async () => {
    const { member, brownie } = await shop();

    const error = await errorOf(
      member.core.sales.recordSale({
        customerId: null,
        items: [{ productId: brownie.id, quantity: 1 }],
        payment: { type: 'fiado' },
      }),
    );
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.fieldErrors).toEqual({ payment: 'Escolha o cliente para vender fiado.' });

    const raw = await member.rawClient.rpc('record_sale', {
      p_customer_id: null as unknown as string,
      p_items: [{ product_id: brownie.id, quantity: 1, unit_price_cents: null }],
      p_payment_method: null as unknown as string,
    });
    expect(raw.error?.message).toBe('INVALID_INPUT');
  });

  it('venda paga na hora não entra no saldo devedor', async () => {
    const { member, julia, brownie } = await shop();

    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 3 }],
      payment: { type: 'paidNow', method: 'cash' },
    });

    expect(sale.paymentType).toBe('paidNow');
    expect(await member.core.payments.getCustomerBalance(julia.id)).toEqual({
      customerId: julia.id,
      balanceCents: 0,
      debtSince: null,
      sales: [
        {
          saleId: sale.id,
          createdAt: sale.createdAt,
          totalCents: 900,
          paidCents: 900,
          remainingCents: 0,
          status: 'paid',
        },
      ],
    });
  });
});

describe('pagamento de dívida', () => {
  it('pagamento parcial abate o saldo; o restante quita a venda', async () => {
    const { member, julia, brownie } = await shop();
    const sale = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });

    const partial = await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 250,
      method: 'pix',
    });

    expect(partial.payment).toMatchObject({
      customerId: julia.id,
      amountCents: 250,
      method: 'pix',
      status: 'active',
      recordedBy: { id: member.userId, email: member.email },
    });
    expect(partial.balance).toMatchObject({
      balanceCents: 350,
      debtSince: sale.createdAt,
      sales: [{ saleId: sale.id, paidCents: 250, remainingCents: 350, status: 'partial' }],
    });

    const rest = await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 350,
      method: 'cash',
    });

    expect(rest.payment).toMatchObject({ amountCents: 350, method: 'cash' });
    expect(rest.balance).toMatchObject({
      balanceCents: 0,
      debtSince: null,
      sales: [{ saleId: sale.id, paidCents: 600, remainingCents: 0, status: 'paid' }],
    });
    expect(await member.core.payments.getCustomerBalance(julia.id)).toEqual(rest.balance);
  });

  it('pagamentos quitam primeiro as vendas fiado mais antigas (FIFO)', async () => {
    const { member, julia, brownie } = await shop();
    const fiado = (quantity: number) =>
      member.core.sales.recordSale({
        customerId: julia.id,
        items: [{ productId: brownie.id, quantity }],
        payment: { type: 'fiado' },
      });
    const first = await fiado(1); // R$ 3,00
    // Paga na hora no meio: se paga sozinha e não recebe nada dos pagamentos de dívida.
    const paidNow = await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'paidNow', method: 'pix' },
    });
    const second = await fiado(2); // R$ 6,00
    const third = await fiado(3); // R$ 9,00

    const after500 = await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 500,
      method: 'pix',
    });

    expect(after500.balance.balanceCents).toBe(1300);
    expect(after500.balance.debtSince).toBe(second.createdAt);
    expect(after500.balance.sales).toMatchObject([
      { saleId: first.id, totalCents: 300, paidCents: 300, remainingCents: 0, status: 'paid' },
      { saleId: paidNow.id, totalCents: 300, paidCents: 300, remainingCents: 0, status: 'paid' },
      {
        saleId: second.id,
        totalCents: 600,
        paidCents: 200,
        remainingCents: 400,
        status: 'partial',
      },
      { saleId: third.id, totalCents: 900, paidCents: 0, remainingCents: 900, status: 'open' },
    ]);

    const after900 = await member.core.payments.recordPayment({
      customerId: julia.id,
      amountCents: 900,
      method: 'cash',
    });

    expect(after900.balance.balanceCents).toBe(400);
    expect(after900.balance.debtSince).toBe(third.createdAt);
    expect(after900.balance.sales.map((s) => [s.status, s.remainingCents])).toEqual([
      ['paid', 0],
      ['paid', 0],
      ['paid', 0],
      ['partial', 400],
    ]);
  });

  it('pagamento acima do saldo é recusado com o saldo na mensagem', async () => {
    const { member, julia, brownie } = await shop();

    const noDebt = await errorOf(
      member.core.payments.recordPayment({ customerId: julia.id, amountCents: 100, method: 'pix' }),
    );
    expect(noDebt.code).toBe('PAYMENT_EXCEEDS_BALANCE');
    expect(noDebt.message).toBe('Este cliente não tem saldo devedor.');

    await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });
    const tooMuch = await errorOf(
      member.core.payments.recordPayment({ customerId: julia.id, amountCents: 601, method: 'pix' }),
    );

    expect(tooMuch.code).toBe('PAYMENT_EXCEEDS_BALANCE');
    expect(tooMuch.message).toBe('O saldo devedor é R$ 6,00. Registre no máximo esse valor.');
    expect(tooMuch.fieldErrors).toEqual({
      amountCents: 'O saldo devedor é R$ 6,00. Registre no máximo esse valor.',
    });
    expect((await member.core.payments.getCustomerBalance(julia.id)).balanceCents).toBe(600);
  });

  it('dois pagamentos ao mesmo tempo não passam do saldo', async () => {
    const { member, julia, brownie } = await shop();
    await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });

    const results = await Promise.allSettled([
      member.core.payments.recordPayment({ customerId: julia.id, amountCents: 400, method: 'pix' }),
      member.core.payments.recordPayment({ customerId: julia.id, amountCents: 400, method: 'pix' }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect((await member.core.payments.getCustomerBalance(julia.id)).balanceCents).toBe(200);
  });

  it('cliente inexistente', async () => {
    const { member } = await shop();
    const missingId = '00000000-0000-4000-8000-000000000000';

    const codes = await Promise.all([
      errorOf(member.core.payments.getCustomerBalance(missingId)),
      errorOf(member.core.payments.getCustomerBalance('abc')),
      errorOf(
        member.core.payments.recordPayment({
          customerId: missingId,
          amountCents: 1,
          method: 'pix',
        }),
      ),
      errorOf(
        member.core.payments.recordPayment({ customerId: 'abc', amountCents: 1, method: 'pix' }),
      ),
    ]);
    expect(codes.map((e) => e.code)).toEqual([
      'CUSTOMER_NOT_FOUND',
      'CUSTOMER_NOT_FOUND',
      'CUSTOMER_NOT_FOUND',
      'CUSTOMER_NOT_FOUND',
    ]);
  });
});

describe('validação do pagamento', () => {
  // Nada é gravado: uma loja só para os casos.
  let member: TestPerson;
  let customerId: string;
  beforeAll(async () => {
    const created = await shop();
    member = created.member;
    customerId = created.julia.id;
  });

  it.each<[string, Omit<RecordPaymentInput, 'customerId'>, Record<string, string>]>([
    [
      'valor ilegível',
      { amountCents: Number.NaN, method: 'pix' },
      { amountCents: 'Informe o valor, como 8,50.' },
    ],
    [
      'valor quebrado',
      { amountCents: 1.5, method: 'pix' },
      { amountCents: 'Informe o valor, como 8,50.' },
    ],
    [
      'valor zero',
      { amountCents: 0, method: 'pix' },
      { amountCents: 'O valor precisa ser maior que zero.' },
    ],
    [
      'valor negativo',
      { amountCents: -100, method: 'cash' },
      { amountCents: 'O valor precisa ser maior que zero.' },
    ],
    [
      'acima de R$ 1.000.000,00',
      { amountCents: 100_000_001, method: 'pix' },
      { amountCents: 'Use no máximo R$ 1.000.000,00.' },
    ],
    [
      'forma desconhecida',
      { amountCents: 100, method: 'cartao' as 'pix' },
      { method: 'Escolha Pix ou dinheiro.' },
    ],
  ])('%s', async (_name, input, fieldErrors) => {
    const error = await errorOf(member.core.payments.recordPayment({ customerId, ...input }));
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.fieldErrors).toEqual(fieldErrors);
  });

  it('sem login, nada é lido nem registrado', async () => {
    const core = anonymousCore();
    const reading = await errorOf(core.payments.getCustomerBalance(customerId));
    const paying = await errorOf(
      core.payments.recordPayment({ customerId, amountCents: 100, method: 'pix' }),
    );
    expect([reading.code, paying.code]).toEqual(['NOT_AUTHENTICATED', 'NOT_AUTHENTICATED']);
  });
});

describe('isolamento do saldo e dos pagamentos', () => {
  it('outra loja não vê o saldo nem registra pagamento para o cliente alheio', async () => {
    const { member, julia, brownie } = await shop();
    await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 2 }],
      payment: { type: 'fiado' },
    });
    const other = await newSignedInPerson();
    await other.core.store.createStore({
      name: 'Loja do Bruno',
      pixKey: 'bruno@example.com',
      city: 'Contagem',
    });

    const reading = await errorOf(other.core.payments.getCustomerBalance(julia.id));
    const paying = await errorOf(
      other.core.payments.recordPayment({ customerId: julia.id, amountCents: 600, method: 'pix' }),
    );
    const raw = await other.rawClient.rpc('record_payment', {
      p_customer_id: julia.id,
      p_amount_cents: 600,
      p_method: 'pix',
    });
    const rawBalance = await other.rawClient.rpc('get_customer_balance', {
      p_customer_id: julia.id,
    });

    expect([reading.code, paying.code]).toEqual(['CUSTOMER_NOT_FOUND', 'CUSTOMER_NOT_FOUND']);
    expect(raw.error?.message).toBe('CUSTOMER_NOT_FOUND');
    expect(rawBalance.error?.message).toBe('CUSTOMER_NOT_FOUND');
    expect((await member.core.payments.getCustomerBalance(julia.id)).balanceCents).toBe(600);
  });

  it('sem login, a chave pública não chama as funções de saldo e pagamento', async () => {
    const { member, julia, brownie } = await shop();
    await member.core.sales.recordSale({
      customerId: julia.id,
      items: [{ productId: brownie.id, quantity: 1 }],
      payment: { type: 'fiado' },
    });
    const anon = anonymousClient();

    const balance = await anon.rpc('get_customer_balance', { p_customer_id: julia.id });
    const payment = await anon.rpc('record_payment', {
      p_customer_id: julia.id,
      p_amount_cents: 300,
      p_method: 'pix',
    });

    expect(balance.data).toBeNull();
    expect(balance.error).not.toBeNull();
    expect(payment.error).not.toBeNull();
    expect((await member.core.payments.getCustomerBalance(julia.id)).balanceCents).toBe(300);
  });
});
