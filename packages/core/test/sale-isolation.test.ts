import { describe, expect, it } from 'vitest';
import { isCoreError, type Customer, type Product, type Sale } from '../src';
import { anonymousClient, newSignedInPerson, type TestPerson } from './support/members';

// Ponto de vista do atacante: outra loja, ou alguém sem login com a chave pública,
// usando o Supabase direto (rawClient). O efeito é conferido pelo core do dono.

interface OwnerWithSale {
  owner: TestPerson;
  customer: Customer;
  product: Product;
  sale: Sale;
}

async function ownerWithSale(): Promise<OwnerWithSale> {
  const owner = await newSignedInPerson();
  await owner.core.store.createStore({
    name: 'Doces da Ana',
    pixKey: 'ana@example.com',
    city: 'Contagem',
  });
  const customer = await owner.core.customers.createCustomer({
    name: 'Júlia',
    whatsapp: '31 99876-5432',
    pin: '4821',
    consented: true,
  });
  const product = await owner.core.catalog.createProduct({
    name: 'Brownie',
    priceCents: 300,
    points: 1,
  });
  const sale = await owner.core.sales.recordSale({
    customerId: customer.id,
    items: [{ productId: product.id, quantity: 2 }],
    payment: { type: 'paidNow', method: 'pix' },
  });
  return { owner, customer, product, sale };
}

async function otherStoreMember(): Promise<TestPerson> {
  const other = await newSignedInPerson();
  await other.core.store.createStore({
    name: 'Loja do Bruno',
    pixKey: 'bruno@example.com',
    city: 'Contagem',
  });
  return other;
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return isCoreError(error) ? error.code : 'not-core-error';
  }
}

describe('isolamento de vendas entre lojas', () => {
  it('membro de outra loja não vê a venda, os itens nem o pagamento', async () => {
    const { owner, sale } = await ownerWithSale();
    const other = await otherStoreMember();

    expect(await codeOf(other.core.sales.getSale(sale.id))).toBe('SALE_NOT_FOUND');
    const sales = await other.rawClient.from('sales').select('id');
    const items = await other.rawClient.from('sale_items').select('id');
    const payments = await other.rawClient.from('payments').select('id');
    const members = await other.rawClient.rpc('list_store_members');

    expect([sales.data, items.data, payments.data]).toEqual([[], [], []]);
    expect(members.data?.map((m) => m.email)).toEqual([other.email]);
    expect((await owner.core.sales.getSale(sale.id)).totalCents).toBe(600);
  });

  it('membro de outra loja não vende com cliente nem produto alheios', async () => {
    const { customer, product } = await ownerWithSale();
    const other = await otherStoreMember();
    const own = await other.core.catalog.createProduct({ name: 'Cocada', priceCents: 400 });

    expect(
      await codeOf(
        other.core.sales.recordSale({
          customerId: customer.id,
          items: [{ productId: own.id, quantity: 1 }],
          payment: { type: 'paidNow', method: 'pix' },
        }),
      ),
    ).toBe('CUSTOMER_NOT_FOUND');
    expect(
      await codeOf(
        other.core.sales.recordSale({
          customerId: null,
          items: [{ productId: product.id, quantity: 1 }],
          payment: { type: 'paidNow', method: 'pix' },
        }),
      ),
    ).toBe('PRODUCT_NOT_FOUND');
  });

  it('ninguém grava venda, item ou pagamento direto nas tabelas', async () => {
    const { owner, sale, product } = await ownerWithSale();
    const { data: store } = await owner.rawClient.from('stores').select('id').single();
    const storeId = store?.id ?? '';

    // Nem o próprio membro: só a operação "registrar venda" grava.
    const insertSale = await owner.rawClient
      .from('sales')
      .insert({ store_id: storeId, recorded_by: owner.userId });
    const insertItem = await owner.rawClient.from('sale_items').insert({
      store_id: storeId,
      sale_id: sale.id,
      position: 9,
      product_id: product.id,
      product_name: 'Brinde',
      unit_price_cents: 1,
      points: 9999,
      quantity: 1,
    });
    const insertPayment = await owner.rawClient.from('payments').insert({
      store_id: storeId,
      sale_id: sale.id,
      amount_cents: 1,
      method: 'cash',
      recorded_by: owner.userId,
    });
    const updatePayment = await owner.rawClient
      .from('payments')
      .update({ amount_cents: 1 })
      .eq('sale_id', sale.id);
    const deleteItems = await owner.rawClient.from('sale_items').delete().eq('sale_id', sale.id);

    expect(insertSale.error).not.toBeNull();
    expect(insertItem.error).not.toBeNull();
    expect(insertPayment.error).not.toBeNull();
    expect(updatePayment.error).not.toBeNull();
    expect(deleteItems.error).not.toBeNull();
    const reread = await owner.core.sales.getSale(sale.id);
    expect(reread.items).toHaveLength(1);
    expect(reread.payments).toMatchObject([{ amountCents: 600 }]);
  });

  it('sem login, nada de vendas vaza nem é registrado', async () => {
    const { owner, product, sale } = await ownerWithSale();
    const anon = anonymousClient();

    const sales = await anon.from('sales').select('id');
    const payments = await anon.from('payments').select('id');
    const members = await anon.rpc('list_store_members');
    const recorded = await anon.rpc('record_sale', {
      p_customer_id: null as unknown as string,
      p_items: [{ product_id: product.id, quantity: 1 }],
      p_payment_method: 'pix',
    });

    expect(sales.data ?? []).toEqual([]);
    expect(payments.data ?? []).toEqual([]);
    expect(members.error).not.toBeNull();
    expect(recorded.error).not.toBeNull();
    expect((await owner.core.sales.getSale(sale.id)).payments).toHaveLength(1);
  });
});
