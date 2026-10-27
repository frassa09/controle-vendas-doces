import { describe, expect, it } from 'vitest';
import { CoreError, type StoreDetailsInput } from '../src';
import { anonymousCore, newSignedInPerson } from './support/members';

const validStore: StoreDetailsInput = {
  name: 'Doces da Júlia',
  pixKey: 'julia@example.com',
  city: 'Belo Horizonte',
};

describe('criar loja', () => {
  it('o dono cria a loja com nome, chave Pix e cidade e passa a vê-la como sua', async () => {
    const owner = await newSignedInPerson();

    const created = await owner.core.store.createStore(validStore);

    expect(created).toMatchObject(validStore);
    expect(await owner.core.store.getMyStore()).toEqual(created);
  });

  it('guarda os dados sem os espaços digitados nas pontas', async () => {
    const owner = await newSignedInPerson();

    const created = await owner.core.store.createStore({
      name: '  Doces da Júlia ',
      pixKey: ' julia@example.com',
      city: 'Belo Horizonte  ',
    });

    expect(created).toMatchObject(validStore);
  });

  it.each([
    ['name', 'Informe o nome da loja.'],
    ['pixKey', 'Informe a chave Pix da loja.'],
    ['city', 'Informe a cidade da loja.'],
  ] as const)('recusa a loja sem %s e não cria nada', async (field, message) => {
    const owner = await newSignedInPerson();

    const attempt = owner.core.store.createStore({ ...validStore, [field]: '   ' });

    await expect(attempt).rejects.toBeInstanceOf(CoreError);
    await expect(attempt).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      fieldErrors: { [field]: message },
    });
    expect(await owner.core.store.getMyStore()).toBeNull();
  });

  it('aponta todos os campos que faltam de uma vez', async () => {
    const owner = await newSignedInPerson();

    await expect(
      owner.core.store.createStore({ name: '', pixKey: '', city: '' }),
    ).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      fieldErrors: {
        name: 'Informe o nome da loja.',
        pixKey: 'Informe a chave Pix da loja.',
        city: 'Informe a cidade da loja.',
      },
    });
  });

  it('recusa chave Pix maior que o limite do Pix copia-e-cola', async () => {
    const owner = await newSignedInPerson();

    await expect(
      owner.core.store.createStore({ ...validStore, pixKey: 'a'.repeat(78) }),
    ).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      fieldErrors: { pixKey: 'Use no máximo 77 caracteres.' },
    });
  });

  it('não deixa quem já tem loja criar outra', async () => {
    const owner = await newSignedInPerson();
    const first = await owner.core.store.createStore(validStore);

    await expect(
      owner.core.store.createStore({ ...validStore, name: 'Outra loja' }),
    ).rejects.toMatchObject({ code: 'ALREADY_HAS_STORE' });
    expect(await owner.core.store.getMyStore()).toEqual(first);
  });

  it('exige login', async () => {
    await expect(anonymousCore().store.createStore(validStore)).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED',
    });
  });
});

describe('obter minha loja', () => {
  it('é vazia no primeiro acesso, antes de criar a loja', async () => {
    const person = await newSignedInPerson();

    expect(await person.core.store.getMyStore()).toBeNull();
  });

  it('exige login', async () => {
    await expect(anonymousCore().store.getMyStore()).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED',
    });
  });
});
