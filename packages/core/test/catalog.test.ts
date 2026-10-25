import { beforeAll, describe, expect, it } from 'vitest';
import { anonymousCore, newSignedInPerson, type TestPerson } from './support/members';

async function memberWithStore(): Promise<TestPerson> {
  const owner = await newSignedInPerson();
  await owner.core.store.createStore({
    name: 'Doces da Júlia',
    pixKey: 'julia@example.com',
    city: 'Belo Horizonte',
  });
  return owner;
}

describe('cadastrar produto', () => {
  it('cria um produto com nome e preço, sem pontos, ativo e fora dos prêmios', async () => {
    const member = await memberWithStore();

    const brownie = await member.core.catalog.createProduct({ name: 'Brownie', priceCents: 300 });

    expect(brownie).toMatchObject({
      name: 'Brownie',
      priceCents: 300,
      points: 0,
      canBePrize: false,
      isActive: true,
      isCombo: false,
    });
    expect(await member.core.catalog.getProduct(brownie.id)).toEqual(brownie);
  });

  it('cria um combo com preço e pontos próprios, que pode ser prêmio', async () => {
    const member = await memberWithStore();

    const combo = await member.core.catalog.createProduct({
      name: '  3 brownies ',
      priceCents: 800,
      points: 3,
      canBePrize: true,
      isCombo: true,
    });

    expect(combo).toMatchObject({
      name: '3 brownies',
      priceCents: 800,
      points: 3,
      canBePrize: true,
      isActive: true,
      isCombo: true,
    });
  });

  it('aceita preço de um centavo e zero pontos', async () => {
    const member = await memberWithStore();

    const bala = await member.core.catalog.createProduct({
      name: 'Bala',
      priceCents: 1,
      points: 0,
    });

    expect(bala).toMatchObject({ priceCents: 1, points: 0 });
  });

  describe('validação', () => {
    // Uma loja só para as tentativas recusadas: como nada é cadastrado, o catálogo
    // dela continua vazio (e poupa o limite de logins do Supabase).
    let member: TestPerson;
    beforeAll(async () => {
      member = await memberWithStore();
    });

    it.each([
      [{ name: '   ', priceCents: 300 }, { name: 'Informe o nome do produto.' }],
      [{ name: 'a'.repeat(81), priceCents: 300 }, { name: 'Use no máximo 80 caracteres.' }],
      [{ name: 'Brownie', priceCents: 0 }, { priceCents: 'O preço precisa ser maior que zero.' }],
      [
        { name: 'Brownie', priceCents: -300 },
        { priceCents: 'O preço precisa ser maior que zero.' },
      ],
      [{ name: 'Brownie', priceCents: Number.NaN }, { priceCents: 'Informe o preço, como 8,50.' }],
      [{ name: 'Brownie', priceCents: 2.5 }, { priceCents: 'Informe o preço, como 8,50.' }],
      [{ name: 'Brownie', priceCents: 1_000_001 }, { priceCents: 'Use no máximo R$ 10.000,00.' }],
      [
        { name: 'Brownie', priceCents: 300, points: -1 },
        { points: 'Os pontos não podem ser negativos.' },
      ],
      [
        { name: 'Brownie', priceCents: 300, points: 1.5 },
        { points: 'Use um número inteiro de pontos.' },
      ],
      [
        { name: 'Brownie', priceCents: 300, points: 10_000 },
        { points: 'Use no máximo 9999 pontos.' },
      ],
    ])('recusa %o e não cadastra nada', async (input, fieldErrors) => {
      await expect(member.core.catalog.createProduct(input)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        fieldErrors,
      });
      expect(await member.core.catalog.listProducts()).toEqual([]);
    });

    it('aponta todos os campos inválidos de uma vez', async () => {
      await expect(
        member.core.catalog.createProduct({ name: '', priceCents: 0, points: -2 }),
      ).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        fieldErrors: {
          name: 'Informe o nome do produto.',
          priceCents: 'O preço precisa ser maior que zero.',
          points: 'Os pontos não podem ser negativos.',
        },
      });
      expect(await member.core.catalog.listProducts()).toEqual([]);
    });
  });

  it('exige login', async () => {
    await expect(
      anonymousCore().catalog.createProduct({ name: 'Brownie', priceCents: 300 }),
    ).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
  });

  it('exige que a pessoa tenha loja', async () => {
    const person = await newSignedInPerson();

    await expect(
      person.core.catalog.createProduct({ name: 'Brownie', priceCents: 300 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('editar produto', () => {
  it('troca nome, preço, pontos e marcações', async () => {
    const member = await memberWithStore();
    const brownie = await member.core.catalog.createProduct({ name: 'Brownie', priceCents: 300 });

    const edited = await member.core.catalog.updateProduct(brownie.id, {
      name: 'Brownie de nozes',
      priceCents: 450,
      points: 2,
      canBePrize: true,
      isCombo: false,
    });

    expect(edited).toEqual({
      ...brownie,
      name: 'Brownie de nozes',
      priceCents: 450,
      points: 2,
      canBePrize: true,
    });
    expect(await member.core.catalog.getProduct(brownie.id)).toEqual(edited);
  });

  it('não muda se ativo ou inativo', async () => {
    const member = await memberWithStore();
    const brownie = await member.core.catalog.createProduct({ name: 'Brownie', priceCents: 300 });
    await member.core.catalog.deactivateProduct(brownie.id);

    const edited = await member.core.catalog.updateProduct(brownie.id, {
      name: 'Brownie',
      priceCents: 350,
    });

    expect(edited).toMatchObject({ priceCents: 350, isActive: false });
  });

  it('recusa dados inválidos e mantém o produto como estava', async () => {
    const member = await memberWithStore();
    const brownie = await member.core.catalog.createProduct({ name: 'Brownie', priceCents: 300 });

    await expect(
      member.core.catalog.updateProduct(brownie.id, { name: 'Brownie', priceCents: -1 }),
    ).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      fieldErrors: { priceCents: 'O preço precisa ser maior que zero.' },
    });
    expect(await member.core.catalog.getProduct(brownie.id)).toEqual(brownie);
  });

  it('avisa quando o produto não existe', async () => {
    const member = await memberWithStore();

    await expect(
      member.core.catalog.updateProduct('00000000-0000-4000-8000-000000000000', {
        name: 'Brownie',
        priceCents: 300,
      }),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    await expect(
      member.core.catalog.getProduct('00000000-0000-4000-8000-000000000000'),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });
});

describe('ativar e desativar produto', () => {
  it('desativado sai da venda mas continua no catálogo; ativado volta à venda', async () => {
    const member = await memberWithStore();
    const brownie = await member.core.catalog.createProduct({ name: 'Brownie', priceCents: 300 });
    const brigadeiro = await member.core.catalog.createProduct({
      name: 'Brigadeiro',
      priceCents: 250,
    });

    const off = await member.core.catalog.deactivateProduct(brownie.id);

    expect(off).toEqual({ ...brownie, isActive: false });
    expect(await member.core.catalog.listProducts({ activeOnly: true })).toEqual([brigadeiro]);
    expect(await member.core.catalog.listProducts()).toEqual([brigadeiro, off]);
    expect(await member.core.catalog.getProduct(brownie.id)).toEqual(off);

    const on = await member.core.catalog.activateProduct(brownie.id);

    expect(on).toEqual(brownie);
    expect(await member.core.catalog.listProducts({ activeOnly: true })).toEqual([
      brigadeiro,
      brownie,
    ]);
  });

  it('avisa quando o produto não existe', async () => {
    const member = await memberWithStore();

    await expect(
      member.core.catalog.deactivateProduct('00000000-0000-4000-8000-000000000000'),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });
});

describe('listar catálogo', () => {
  it('mostra os ativos antes dos inativos, cada grupo em ordem alfabética', async () => {
    const member = await memberWithStore();
    const create = (name: string) => member.core.catalog.createProduct({ name, priceCents: 300 });
    await create('Pudim');
    await create('bolo de pote');
    await create('Água');
    const brownie = await create('Brownie');
    const cocada = await create('Cocada');
    await member.core.catalog.deactivateProduct(cocada.id);
    await member.core.catalog.deactivateProduct(brownie.id);

    const names = (await member.core.catalog.listProducts()).map((product) => product.name);

    expect(names).toEqual(['Água', 'bolo de pote', 'Pudim', 'Brownie', 'Cocada']);
  });

  it('exige login', async () => {
    await expect(anonymousCore().catalog.listProducts()).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED',
    });
  });
});
