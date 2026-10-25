import { describe, expect, it } from 'vitest';
import type { StoreDetailsInput } from '../src';
import { anonymousCore, newSignedInPerson, type TestPerson } from './support/members';

const anaStore: StoreDetailsInput = {
  name: 'Doces da Ana',
  pixKey: 'ana@example.com',
  city: 'Contagem',
};

async function ownerWithStore(details: StoreDetailsInput = anaStore): Promise<TestPerson> {
  const owner = await newSignedInPerson();
  await owner.core.store.createStore(details);
  return owner;
}

describe('convite do segundo membro', () => {
  it('quem entra com o código passa a ver a mesma loja do dono', async () => {
    const owner = await ownerWithStore();
    const invite = await owner.core.store.createInvite();
    const partner = await newSignedInPerson();

    const joined = await partner.core.store.joinWithInvite(invite.code);

    const ownerStore = await owner.core.store.getMyStore();
    expect(joined).toEqual(ownerStore);
    expect(await partner.core.store.getMyStore()).toEqual(ownerStore);
  });

  it('recusa um código que já foi usado, com mensagem clara', async () => {
    const owner = await ownerWithStore();
    const invite = await owner.core.store.createInvite();
    const partner = await newSignedInPerson();
    await partner.core.store.joinWithInvite(invite.code);
    const latecomer = await newSignedInPerson();

    await expect(latecomer.core.store.joinWithInvite(invite.code)).rejects.toMatchObject({
      code: 'INVITE_ALREADY_USED',
      message: 'Este código já foi usado. Peça um código novo para quem te convidou.',
    });
    expect(await latecomer.core.store.getMyStore()).toBeNull();
  });

  it('recusa um código que não existe, com mensagem clara', async () => {
    await ownerWithStore();
    const stranger = await newSignedInPerson();

    await expect(stranger.core.store.joinWithInvite('ZZZZ-2222')).rejects.toMatchObject({
      code: 'INVITE_NOT_FOUND',
      message: 'Não encontramos esse código. Confira as letras e os números.',
    });
    expect(await stranger.core.store.getMyStore()).toBeNull();
  });

  it('pede o código quando nada foi digitado', async () => {
    await expect(anonymousCore().store.joinWithInvite('  - ')).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      fieldErrors: { code: 'Digite o código do convite.' },
    });
  });

  it('aceita o código digitado em minúsculas, sem hífen e com espaços', async () => {
    const owner = await ownerWithStore();
    const invite = await owner.core.store.createInvite();
    const partner = await newSignedInPerson();

    const typed = ` ${invite.code.replace('-', '').toLowerCase()} `;

    await expect(partner.core.store.joinWithInvite(typed)).resolves.toMatchObject(anaStore);
  });

  it('o código tem 8 letras e números fáceis de ditar, em dois grupos', async () => {
    const owner = await ownerWithStore();

    const invite = await owner.core.store.createInvite();

    expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it('quem já tem loja não entra em outra, e o código continua valendo', async () => {
    const owner = await ownerWithStore();
    const invite = await owner.core.store.createInvite();
    const otherOwner = await ownerWithStore({ ...anaStore, name: 'Loja do Bruno' });

    await expect(otherOwner.core.store.joinWithInvite(invite.code)).rejects.toMatchObject({
      code: 'ALREADY_HAS_STORE',
    });
    expect(await otherOwner.core.store.getMyStore()).toMatchObject({ name: 'Loja do Bruno' });

    const partner = await newSignedInPerson();
    await expect(partner.core.store.joinWithInvite(invite.code)).resolves.toMatchObject(anaStore);
  });

  it('gerar um código novo faz o anterior, ainda não usado, deixar de valer', async () => {
    const owner = await ownerWithStore();
    const first = await owner.core.store.createInvite();
    const second = await owner.core.store.createInvite();
    const partner = await newSignedInPerson();

    await expect(partner.core.store.joinWithInvite(first.code)).rejects.toMatchObject({
      code: 'INVITE_NOT_FOUND',
    });
    await expect(partner.core.store.joinWithInvite(second.code)).resolves.toMatchObject(anaStore);
  });

  it('o dono vê o código disponível até alguém usá-lo', async () => {
    const owner = await ownerWithStore();
    expect(await owner.core.store.getOpenInvite()).toBeNull();

    const invite = await owner.core.store.createInvite();
    expect(await owner.core.store.getOpenInvite()).toEqual(invite);

    const partner = await newSignedInPerson();
    await partner.core.store.joinWithInvite(invite.code);
    expect(await owner.core.store.getOpenInvite()).toBeNull();
  });

  it('quem entrou altera os dados da loja e o dono vê a alteração', async () => {
    const owner = await ownerWithStore();
    const invite = await owner.core.store.createInvite();
    const partner = await newSignedInPerson();
    await partner.core.store.joinWithInvite(invite.code);

    await partner.core.store.updateStoreDetails({
      name: 'Doces da Ana e da Bia',
      pixKey: 'bia@example.com',
      city: 'Betim',
    });

    expect(await owner.core.store.getMyStore()).toMatchObject({
      name: 'Doces da Ana e da Bia',
      pixKey: 'bia@example.com',
      city: 'Betim',
    });
  });

  it('quem entrou também pode convidar, como o dono', async () => {
    const owner = await ownerWithStore();
    const partner = await newSignedInPerson();
    await partner.core.store.joinWithInvite((await owner.core.store.createInvite()).code);

    const invite = await partner.core.store.createInvite();

    expect(await owner.core.store.getOpenInvite()).toEqual(invite);
  });

  it('quem entrou continua sem acesso a outras lojas', async () => {
    const owner = await ownerWithStore();
    const otherOwner = await ownerWithStore({ ...anaStore, name: 'Loja do Bruno' });
    const otherStore = await otherOwner.core.store.getMyStore();
    const partner = await newSignedInPerson();
    await partner.core.store.joinWithInvite((await owner.core.store.createInvite()).code);

    const stores = await partner.rawClient.from('stores').select('id, name');
    await partner.rawClient
      .from('stores')
      .update({ name: 'Invadida' })
      .eq('id', otherStore?.id ?? '');

    expect(stores.data?.map((store) => store.name)).toEqual(['Doces da Ana']);
    expect(await otherOwner.core.store.getMyStore()).toMatchObject({ name: 'Loja do Bruno' });
  });

  it('não dá para ver nem usar convites de outra loja pulando o core', async () => {
    const owner = await ownerWithStore();
    await owner.core.store.createInvite();
    const attacker = await ownerWithStore({ ...anaStore, name: 'Loja do Bruno' });

    const invites = await attacker.rawClient.from('store_invites').select('code');

    expect(invites.data).toEqual([]);
  });

  it('quem não tem loja não gera código de convite', async () => {
    const outsider = await newSignedInPerson();

    await expect(outsider.core.store.createInvite()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
