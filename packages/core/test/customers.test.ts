import { describe, expect, it } from 'vitest';
import { isCoreError, type CoreError } from '../src';
import { anonymousCore, newSignedInPerson, type TestPerson } from './support/members';

async function memberWithStore(name = 'Doces da Ana'): Promise<TestPerson> {
  const person = await newSignedInPerson();
  await person.core.store.createStore({ name, pixKey: 'ana@example.com', city: 'Contagem' });
  return person;
}

// O limite de login do Supabase é compartilhado; testes que só leem o que eles
// mesmos gravaram reaproveitam um membro (e uma loja). Os de busca e os que
// conferem "nada foi gravado" têm loja própria.
let shared: Promise<TestPerson> | undefined;
function sharedMember(): Promise<TestPerson> {
  shared ??= memberWithStore('Doces Compartilhados');
  return shared;
}

async function failure(promise: Promise<unknown>): Promise<CoreError> {
  try {
    await promise;
  } catch (error) {
    if (isCoreError(error)) return error;
    throw error;
  }
  throw new Error('a operação deveria ter falhado');
}

describe('cadastro de clientes', () => {
  it('cadastra o cliente com os dados normalizados e mostra o perfil', async () => {
    const member = await sharedMember();

    const created = await member.core.customers.createCustomer({
      name: '  Júlia Martins ',
      whatsapp: '(31) 99876-5432',
      reference: ' Filha da dona Marta ',
      notes: 'Prefere brigadeiro.',
      pin: '4821',
      consented: true,
    });
    const profile = await member.core.customers.getCustomer(created.id);

    expect(profile).toMatchObject({
      id: created.id,
      name: 'Júlia Martins',
      whatsapp: '5531998765432',
      reference: 'Filha da dona Marta',
      notes: 'Prefere brigadeiro.',
      pin: '4821',
    });
    expect(profile.consentAt).not.toBeNull();
  });

  it('normaliza o WhatsApp digitado de vários jeitos', async () => {
    const member = await sharedMember();
    const typedAs = async (whatsapp: string) =>
      (
        await member.core.customers.createCustomer({
          name: 'Bia',
          whatsapp,
          pin: '4821',
          consented: false,
        })
      ).whatsapp;

    expect(await typedAs('+55 31 99876-5432')).toBe('5531998765432');
    expect(await typedAs('031 99876 5432')).toBe('5531998765432');
    expect(await typedAs('0 15 31 99876-5432')).toBe('5531998765432');
    // Celular antigo, sem o nono dígito.
    expect(await typedAs('31 9876-5432')).toBe('5531998765432');
    // Fixo (WhatsApp Business).
    expect(await typedAs('(61) 3322-4455')).toBe('556133224455');
  });

  it('recusa WhatsApp ausente ou inválido e acumula os erros dos campos', async () => {
    const member = await memberWithStore();
    const base = { name: 'Bia', pin: '4821', consented: false };

    const missing = await failure(
      member.core.customers.createCustomer({ ...base, name: ' ', whatsapp: '  ', pin: '12' }),
    );
    const badDdd = await failure(
      member.core.customers.createCustomer({ ...base, whatsapp: '(20) 99876-5432' }),
    );
    const tooShort = await failure(
      member.core.customers.createCustomer({ ...base, whatsapp: '99876-5432' }),
    );

    expect(missing.code).toBe('INVALID_INPUT');
    expect(missing.fieldErrors).toEqual({
      name: 'Informe o nome do cliente.',
      whatsapp: 'Informe o WhatsApp do cliente.',
      pin: 'O PIN tem 4 números.',
    });
    expect(badDdd.fieldErrors).toHaveProperty('whatsapp');
    expect(tooShort.fieldErrors).toHaveProperty('whatsapp');
    expect(await member.core.customers.searchCustomers('')).toEqual([]);
  });
});

describe('busca de clientes', () => {
  it('encontra pelo nome ou pela referência, sem diferenciar acentos nem maiúsculas', async () => {
    const member = await memberWithStore();
    const add = (name: string, reference: string | null) =>
      member.core.customers.createCustomer({
        name,
        reference,
        whatsapp: '31 99876-5432',
        pin: '4821',
        consented: true,
      });
    await add('Júlia Martins', 'Portaria do prédio azul');
    await add('Bruno Souza', 'Academia');
    await add('ana Paula', null);

    const names = async (query: string) =>
      (await member.core.customers.searchCustomers(query)).map((c) => c.name);

    expect(await names('')).toEqual(['ana Paula', 'Bruno Souza', 'Júlia Martins']);
    expect(await names('JULIA')).toEqual(['Júlia Martins']);
    expect(await names('  predio   azul ')).toEqual(['Júlia Martins']);
    expect(await names('academia')).toEqual(['Bruno Souza']);
    expect(await names('a')).toEqual(['ana Paula', 'Bruno Souza', 'Júlia Martins']);
    expect(await names('%')).toEqual([]);
    expect(await names('zé')).toEqual([]);
  });

  it('mostra na busca nome, WhatsApp e referência', async () => {
    const member = await memberWithStore();
    const created = await member.core.customers.createCustomer({
      name: 'Carla',
      reference: 'Escola',
      notes: 'Paga sexta',
      whatsapp: '31 99876-5432',
      pin: '4821',
      consented: false,
    });

    expect(await member.core.customers.searchCustomers('carla')).toEqual([
      { id: created.id, name: 'Carla', whatsapp: '5531998765432', reference: 'Escola' },
    ]);
  });
});

describe('edição de clientes', () => {
  it('troca o PIN e os demais dados', async () => {
    const member = await sharedMember();
    const created = await member.core.customers.createCustomer({
      name: 'Carla',
      reference: 'Escola',
      notes: 'Paga sexta',
      whatsapp: '31 99876-5432',
      pin: '4821',
      consented: false,
    });

    await member.core.customers.updateCustomer(created.id, {
      name: 'Carla Dias',
      reference: '',
      notes: null,
      whatsapp: '(11) 91234-5678',
      pin: '0937',
      consented: false,
    });
    const profile = await member.core.customers.getCustomer(created.id);

    expect(profile).toMatchObject({
      name: 'Carla Dias',
      reference: null,
      notes: null,
      whatsapp: '5511912345678',
      pin: '0937',
      linkToken: created.linkToken,
    });
  });

  it('recusa PIN que não tem 4 números', async () => {
    const member = await sharedMember();
    const created = await member.core.customers.createCustomer({
      name: 'Carla',
      whatsapp: '31 99876-5432',
      pin: '4821',
      consented: false,
    });
    const edit = (pin: string) =>
      failure(
        member.core.customers.updateCustomer(created.id, {
          name: 'Carla',
          whatsapp: '31 99876-5432',
          pin,
          consented: false,
        }),
      );

    for (const pin of ['123', '12345', '12a4', '']) {
      expect((await edit(pin)).fieldErrors).toEqual({ pin: 'O PIN tem 4 números.' });
    }
    expect((await member.core.customers.getCustomer(created.id)).pin).toBe('4821');
  });

  it('registra a data do consentimento ao marcar e a mantém nas edições seguintes', async () => {
    const member = await sharedMember();
    const details = { name: 'Carla', whatsapp: '31 99876-5432', pin: '4821' };
    const created = await member.core.customers.createCustomer({ ...details, consented: false });

    const consented = await member.core.customers.updateCustomer(created.id, {
      ...details,
      consented: true,
    });
    const renamed = await member.core.customers.updateCustomer(created.id, {
      ...details,
      name: 'Carla Dias',
      consented: true,
    });
    const withdrawn = await member.core.customers.updateCustomer(created.id, {
      ...details,
      consented: false,
    });

    expect(created).toMatchObject({ consented: false, consentAt: null });
    expect(consented.consented).toBe(true);
    expect(consented.consentAt).not.toBeNull();
    expect(renamed.consentAt).toBe(consented.consentAt);
    expect(withdrawn).toMatchObject({ consented: false, consentAt: null });
  });

  it('avisa quando o cliente não existe', async () => {
    const member = await sharedMember();
    const details = { name: 'Carla', whatsapp: '31 99876-5432', pin: '4821', consented: false };

    const missing = await failure(
      member.core.customers.getCustomer('00000000-0000-4000-8000-000000000000'),
    );
    const malformed = await failure(member.core.customers.getCustomer('nao-e-um-id'));
    const editMissing = await failure(
      member.core.customers.updateCustomer('00000000-0000-4000-8000-000000000000', details),
    );

    expect([missing.code, malformed.code, editMissing.code]).toEqual([
      'CUSTOMER_NOT_FOUND',
      'CUSTOMER_NOT_FOUND',
      'CUSTOMER_NOT_FOUND',
    ]);
  });
});

describe('PIN e token do link', () => {
  it('sugere PINs de 4 dígitos que não são óbvios', () => {
    const member = anonymousCore();
    const pins = Array.from({ length: 200 }, () => member.customers.suggestPin());

    for (const pin of pins) {
      expect(pin).toMatch(/^\d{4}$/);
      expect(['0000', '1111', '1234', '4321', '9999', '0123', '9876']).not.toContain(pin);
    }
    expect(new Set(pins).size).toBeGreaterThan(150);
  });

  it('gera um token longo e diferente para cada cliente', async () => {
    const member = await sharedMember();
    const details = { name: 'Carla', whatsapp: '31 99876-5432', pin: '4821', consented: false };

    const first = await member.core.customers.createCustomer(details);
    const second = await member.core.customers.createCustomer(details);

    expect(first.linkToken).toMatch(/^[0-9a-f]{64}$/);
    expect(second.linkToken).toMatch(/^[0-9a-f]{64}$/);
    expect(first.linkToken).not.toBe(second.linkToken);
  });
});
