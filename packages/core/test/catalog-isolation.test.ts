import { describe, expect, it } from 'vitest';
import { newSignedInPerson, type TestPerson } from './support/members';

// Ponto de vista do atacante: membro de outra loja, pelo core e pela chave pública
// direto (rawClient). O efeito é sempre conferido pelo core do dono.

async function memberWithStore(name: string): Promise<TestPerson> {
  const member = await newSignedInPerson();
  await member.core.store.createStore({ name, pixKey: 'pix@example.com', city: 'Contagem' });
  return member;
}

describe('isolamento do catálogo entre lojas', () => {
  it('membro de outra loja não vê, não edita nem desativa os produtos', async () => {
    const owner = await memberWithStore('Loja da Ana');
    const attacker = await memberWithStore('Loja do Bruno');
    const brownie = await owner.core.catalog.createProduct({ name: 'Brownie', priceCents: 300 });

    expect(await attacker.core.catalog.listProducts()).toEqual([]);
    await expect(attacker.core.catalog.getProduct(brownie.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      attacker.core.catalog.updateProduct(brownie.id, { name: 'Golpe', priceCents: 1 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(attacker.core.catalog.deactivateProduct(brownie.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(await owner.core.catalog.listProducts()).toEqual([brownie]);
  });

  it('nem usando a chave pública direto', async () => {
    const owner = await memberWithStore('Loja da Ana');
    const attacker = await memberWithStore('Loja do Bruno');
    const brownie = await owner.core.catalog.createProduct({ name: 'Brownie', priceCents: 300 });
    const ownerStore = await owner.core.store.getMyStore();
    const attackerStore = await attacker.core.store.getMyStore();

    const read = await attacker.rawClient.from('products').select('*').eq('id', brownie.id);
    await attacker.rawClient
      .from('products')
      .update({ name: 'Golpe', price_cents: 1, is_active: false })
      .eq('id', brownie.id);
    await attacker.rawClient.from('products').delete().eq('id', brownie.id);
    const planted = await attacker.rawClient
      .from('products')
      .insert({ store_id: ownerStore?.id ?? '', name: 'Plantado', price_cents: 100 });
    // Mudar o produto de loja também não pode (store_id não é atualizável).
    const moved = await owner.rawClient
      .from('products')
      .update({ store_id: attackerStore?.id ?? '' })
      .eq('id', brownie.id);

    expect(read.data ?? []).toEqual([]);
    expect(planted.error).not.toBeNull();
    expect(moved.error).not.toBeNull();
    expect(await owner.core.catalog.listProducts()).toEqual([brownie]);
    expect(await attacker.core.catalog.listProducts()).toEqual([]);
  });

  it('ninguém grava produto inválido pulando o core', async () => {
    const owner = await memberWithStore('Loja da Ana');
    const store = await owner.core.store.getMyStore();
    const storeId = store?.id ?? '';

    const attempts = await Promise.all([
      owner.rawClient.from('products').insert({ store_id: storeId, name: 'X', price_cents: 0 }),
      owner.rawClient
        .from('products')
        .insert({ store_id: storeId, name: 'X', price_cents: 100, points: -1 }),
      owner.rawClient.from('products').insert({ store_id: storeId, name: ' X', price_cents: 100 }),
    ]);

    expect(attempts.map((attempt) => attempt.error?.code)).toEqual(['23514', '23514', '23514']);
    expect(await owner.core.catalog.listProducts()).toEqual([]);
  });

  it('quem não está em loja nenhuma não vê produtos', async () => {
    const owner = await memberWithStore('Loja da Ana');
    await owner.core.catalog.createProduct({ name: 'Brownie', priceCents: 300 });
    const outsider = await newSignedInPerson();

    expect(await outsider.core.catalog.listProducts()).toEqual([]);
    const read = await outsider.rawClient.from('products').select('*');
    expect(read.data ?? []).toEqual([]);
  });
});
