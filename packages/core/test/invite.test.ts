import { beforeAll, describe, expect, it } from 'vitest';
import type { Store, StoreDetailsInput, StoreInvite } from '../src';
import { anonymousCore, newSignedInPerson, type TestPerson } from './support/members';

// Logins são caros (limite por IP compartilhado entre tickets): cada describe monta
// as pessoas uma vez e os testes dentro dele não dependem da ordem entre si.

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

describe('entrar com convite', () => {
  it('o dono vê o código disponível e quem o digita, de qualquer jeito, entra na loja', async () => {
    const owner = await ownerWithStore();
    expect(await owner.core.store.getOpenInvite()).toBeNull();

    const invite = await owner.core.store.createInvite();
    expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(await owner.core.store.getOpenInvite()).toEqual(invite);

    const partner = await newSignedInPerson();
    const typed = ` ${invite.code.replace('-', '').toLowerCase()} `;
    const joined = await partner.core.store.joinWithInvite(typed);

    const ownerStore = await owner.core.store.getMyStore();
    expect(joined).toEqual(ownerStore);
    expect(await partner.core.store.getMyStore()).toEqual(ownerStore);
    expect(await owner.core.store.getOpenInvite()).toBeNull();
  });

  it('pede o código quando nada foi digitado', async () => {
    await expect(anonymousCore().store.joinWithInvite('  - ')).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      fieldErrors: { code: 'Digite o código do convite.' },
    });
  });
});

describe('quem entrou com convite', () => {
  let owner: TestPerson;
  let partner: TestPerson;
  let otherOwner: TestPerson;
  let ownStore: Store;
  let otherStore: Store;

  beforeAll(async () => {
    owner = await ownerWithStore();
    otherOwner = await ownerWithStore({ ...anaStore, name: 'Loja do Bruno' });
    partner = await newSignedInPerson();
    ownStore = await partner.core.store.joinWithInvite(
      (await owner.core.store.createInvite()).code,
    );
    const found = await otherOwner.core.store.getMyStore();
    if (!found) throw new Error('loja do Bruno não foi criada');
    otherStore = found;
  });

  it('altera os dados da loja e o dono vê a alteração', async () => {
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

  it('também pode convidar, como o dono', async () => {
    const invite = await partner.core.store.createInvite();

    expect(await owner.core.store.getOpenInvite()).toEqual(invite);
  });

  it('continua sem acesso a outras lojas', async () => {
    const stores = await partner.rawClient.from('stores').select('id');
    await partner.rawClient.from('stores').update({ name: 'Invadida' }).eq('id', otherStore.id);
    const invites = await partner.rawClient
      .from('store_invites')
      .select('code')
      .eq('store_id', otherStore.id);

    expect(stores.data?.map((store) => store.id)).toEqual([ownStore.id]);
    expect(invites.data).toEqual([]);
    expect(await otherOwner.core.store.getMyStore()).toEqual(otherStore);
  });
});

describe('códigos recusados', () => {
  let owner: TestPerson;
  let partner: TestPerson;
  let outsider: TestPerson;
  let usedInvite: StoreInvite;

  beforeAll(async () => {
    owner = await ownerWithStore();
    usedInvite = await owner.core.store.createInvite();
    partner = await newSignedInPerson();
    await partner.core.store.joinWithInvite(usedInvite.code);
    outsider = await newSignedInPerson();
  });

  it('recusa um código que já foi usado, com mensagem clara', async () => {
    await expect(outsider.core.store.joinWithInvite(usedInvite.code)).rejects.toMatchObject({
      code: 'INVITE_ALREADY_USED',
      message: 'Este código já foi usado. Peça um código novo para quem te convidou.',
    });
    expect(await outsider.core.store.getMyStore()).toBeNull();
  });

  it('recusa um código que não existe, com mensagem clara', async () => {
    await expect(outsider.core.store.joinWithInvite('ZZZZ-2222')).rejects.toMatchObject({
      code: 'INVITE_NOT_FOUND',
      message: 'Não encontramos esse código. Confira as letras e os números.',
    });
    expect(await outsider.core.store.getMyStore()).toBeNull();
  });

  it('gerar um código novo faz o anterior, ainda não usado, deixar de valer', async () => {
    const first = await owner.core.store.createInvite();
    const second = await owner.core.store.createInvite();

    await expect(outsider.core.store.joinWithInvite(first.code)).rejects.toMatchObject({
      code: 'INVITE_NOT_FOUND',
    });
    expect(await owner.core.store.getOpenInvite()).toEqual(second);
  });

  it('quem já tem loja não entra com outro código, e o código continua valendo', async () => {
    const invite = await owner.core.store.createInvite();

    await expect(partner.core.store.joinWithInvite(invite.code)).rejects.toMatchObject({
      code: 'ALREADY_HAS_STORE',
    });
    expect(await owner.core.store.getOpenInvite()).toEqual(invite);
  });

  it('quem não tem loja não gera código de convite', async () => {
    await expect(outsider.core.store.createInvite()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
