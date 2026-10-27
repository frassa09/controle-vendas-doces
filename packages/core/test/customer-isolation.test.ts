import { describe, expect, it } from 'vitest';
import { isCoreError, type Customer } from '../src';
import { anonymousClient, newSignedInPerson, type TestPerson } from './support/members';

// Ponto de vista do atacante: outra loja, ou alguém sem login com a chave pública,
// usando o Supabase direto (rawClient). O efeito é conferido pelo core do dono.

async function ownerWithCustomer(): Promise<{ owner: TestPerson; customer: Customer }> {
  const owner = await newSignedInPerson();
  await owner.core.store.createStore({
    name: 'Doces da Ana',
    pixKey: 'ana@example.com',
    city: 'Contagem',
  });
  const customer = await owner.core.customers.createCustomer({
    name: 'Júlia',
    whatsapp: '31 99876-5432',
    reference: 'Portaria',
    pin: '4821',
    consented: true,
  });
  return { owner, customer };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return isCoreError(error) ? error.code : 'not-core-error';
  }
}

describe('isolamento de clientes entre lojas', () => {
  it('membro de outra loja não vê, não busca e não edita o cliente', async () => {
    const { owner, customer } = await ownerWithCustomer();
    const other = await newSignedInPerson();
    await other.core.store.createStore({
      name: 'Loja do Bruno',
      pixKey: 'bruno@example.com',
      city: 'Contagem',
    });

    expect(await other.core.customers.searchCustomers('')).toEqual([]);
    expect(await codeOf(other.core.customers.getCustomer(customer.id))).toBe('CUSTOMER_NOT_FOUND');
    expect(
      await codeOf(
        other.core.customers.updateCustomer(customer.id, {
          name: 'Invadido',
          whatsapp: '11 91234-5678',
          pin: '0000',
          consented: false,
        }),
      ),
    ).toBe('CUSTOMER_NOT_FOUND');

    const read = await other.rawClient.from('customers').select('*').eq('id', customer.id);
    await other.rawClient.from('customers').update({ pin: '0000' }).eq('id', customer.id);
    const { data: ownStore } = await other.rawClient.from('stores').select('id').single();
    const moved = await other.rawClient
      .from('customers')
      .update({ store_id: ownStore?.id ?? '' })
      .eq('id', customer.id);

    expect(read.data ?? []).toEqual([]);
    expect(moved.error).not.toBeNull();
    expect(await owner.core.customers.getCustomer(customer.id)).toMatchObject({
      name: 'Júlia',
      pin: '4821',
    });
  });

  it('ninguém cadastra cliente na loja alheia nem sem loja', async () => {
    const { owner, customer } = await ownerWithCustomer();
    const { data: store } = await owner.rawClient.from('stores').select('id').single();
    const outsider = await newSignedInPerson();

    const insert = await outsider.rawClient.from('customers').insert({
      store_id: store?.id ?? '',
      name: 'Intruso',
      whatsapp: '5531998765432',
      pin: '1234',
    });
    const viaCore = await codeOf(
      outsider.core.customers.createCustomer({
        name: 'Intruso',
        whatsapp: '31 99876-5432',
        pin: '1234',
        consented: false,
      }),
    );

    expect(insert.error).not.toBeNull();
    expect(viaCore).toBe('FORBIDDEN');
    expect((await owner.core.customers.searchCustomers('')).map((c) => c.id)).toEqual([
      customer.id,
    ]);
  });

  it('o membro não escolhe nem troca o token do link nem a data do consentimento', async () => {
    const { owner, customer } = await ownerWithCustomer();
    const { data: store } = await owner.rawClient.from('stores').select('id').single();

    const chosenToken = await owner.rawClient.from('customers').insert({
      store_id: store?.id ?? '',
      name: 'Previsível',
      whatsapp: '5531998765432',
      pin: '1234',
      link_token: 'abc',
    });
    const changedToken = await owner.rawClient
      .from('customers')
      .update({ link_token: 'abc' })
      .eq('id', customer.id);
    const backdated = await owner.rawClient
      .from('customers')
      .update({ consent_at: '2020-01-01T00:00:00Z' })
      .eq('id', customer.id);

    expect(chosenToken.error).not.toBeNull();
    expect(changedToken.error).not.toBeNull();
    expect(backdated.error).not.toBeNull();
    expect(await owner.core.customers.getCustomer(customer.id)).toMatchObject({
      linkToken: customer.linkToken,
      consentAt: customer.consentAt,
    });
  });

  it('sem login nada é lido: nem clientes, nem PIN, nem token, nem a busca', async () => {
    const { customer } = await ownerWithCustomer();
    const anon = anonymousClient();

    const byId = await anon.from('customers').select('*').eq('id', customer.id);
    const byToken = await anon.from('customers').select('id').eq('link_token', customer.linkToken);
    const search = await anon.rpc('search_customers', { p_query: '' });

    expect(byId.data ?? []).toEqual([]);
    expect(byToken.data ?? []).toEqual([]);
    expect(search.data ?? []).toEqual([]);
    expect(search.error).not.toBeNull();
  });
});
