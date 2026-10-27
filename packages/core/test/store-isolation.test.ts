import { describe, expect, it } from 'vitest';
import { newSignedInPerson, type TestPerson } from './support/members';

// Estes testes assumem o ponto de vista de um atacante: alguém com conta própria
// que usa a chave pública direto (rawClient), sem passar pelo core. O que se
// verifica é o efeito observável pelo dono da loja, através do core.

async function ownerWithStore(name: string): Promise<{ owner: TestPerson; storeId: string }> {
  const owner = await newSignedInPerson();
  const store = await owner.core.store.createStore({
    name,
    pixKey: `${name.toLowerCase().replaceAll(' ', '.')}@example.com`,
    city: 'Contagem',
  });
  return { owner, storeId: store.id };
}

describe('isolamento entre lojas', () => {
  it('membro de outra loja continua vendo só a própria loja', async () => {
    const { owner } = await ownerWithStore('Loja da Ana');
    const { owner: other } = await ownerWithStore('Loja do Bruno');

    expect(await other.core.store.getMyStore()).toMatchObject({ name: 'Loja do Bruno' });
    expect(await owner.core.store.getMyStore()).toMatchObject({ name: 'Loja da Ana' });
  });

  it('membro de outra loja não consegue ler a loja nem seus membros', async () => {
    const { storeId } = await ownerWithStore('Loja da Ana');
    const { owner: attacker } = await ownerWithStore('Loja do Bruno');

    const stores = await attacker.rawClient.from('stores').select('*').eq('id', storeId);
    const members = await attacker.rawClient
      .from('store_members')
      .select('*')
      .eq('store_id', storeId);

    expect(stores.data ?? []).toEqual([]);
    expect(members.data ?? []).toEqual([]);
  });

  it('usuário sem loja não consegue ler loja nenhuma', async () => {
    await ownerWithStore('Loja da Ana');
    const outsider = await newSignedInPerson();

    const stores = await outsider.rawClient.from('stores').select('*');

    expect(stores.data ?? []).toEqual([]);
  });

  it('membro de outra loja não consegue alterar a loja', async () => {
    const { owner, storeId } = await ownerWithStore('Loja da Ana');
    const { owner: attacker } = await ownerWithStore('Loja do Bruno');

    await attacker.rawClient
      .from('stores')
      .update({ name: 'Invadida', pix_key: 'golpe@example.com' })
      .eq('id', storeId);
    await attacker.rawClient.from('stores').delete().eq('id', storeId);

    expect(await owner.core.store.getMyStore()).toMatchObject({
      id: storeId,
      name: 'Loja da Ana',
      pixKey: 'loja.da.ana@example.com',
    });
  });

  it('ninguém consegue se colocar como membro de uma loja alheia', async () => {
    const { storeId } = await ownerWithStore('Loja da Ana');
    const intruder = await newSignedInPerson();

    const insert = await intruder.rawClient
      .from('store_members')
      .insert({ store_id: storeId, user_id: intruder.userId });

    expect(insert.error).not.toBeNull();
    expect(await intruder.core.store.getMyStore()).toBeNull();
  });

  it('ninguém cria loja sem os campos obrigatórios nem pulando o core', async () => {
    const person = await newSignedInPerson();

    const attempt = await person.rawClient.rpc('create_store', {
      p_name: ' ',
      p_pix_key: 'x@example.com',
      p_city: 'Contagem',
    });

    expect(attempt.error).not.toBeNull();
    expect(await person.core.store.getMyStore()).toBeNull();
  });
});
