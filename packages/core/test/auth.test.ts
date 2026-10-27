import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { anonymousCore, newSignedInPerson, trackUserForCleanup } from './support/members';

const newEmail = () => `t-${randomUUID()}@test.local`;

describe('cadastro e login', () => {
  it('quem se cadastra já entra e ainda não tem loja', async () => {
    const core = anonymousCore();
    const email = newEmail();

    const member = await core.auth.signUp({ email, password: 'brownie123' });
    trackUserForCleanup(member.id);

    expect(member.email).toBe(email);
    expect(await core.auth.getCurrentMember()).toEqual(member);
    expect(await core.store.getMyStore()).toBeNull();
  });

  it('não cadastra o mesmo e-mail duas vezes', async () => {
    const existing = await newSignedInPerson();

    await expect(
      anonymousCore().auth.signUp({ email: existing.email, password: 'outrasenha' }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
  });

  it('recusa e-mail inválido e senha curta no cadastro', async () => {
    await expect(
      anonymousCore().auth.signUp({ email: 'julia', password: '123' }),
    ).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      fieldErrors: {
        email: 'Esse e-mail não parece válido.',
        password: 'Use pelo menos 6 caracteres.',
      },
    });
  });

  it('entra com e-mail e senha, sem diferenciar maiúsculas no e-mail', async () => {
    const person = await newSignedInPerson();
    const core = anonymousCore();

    const member = await core.auth.signIn({
      email: `  ${person.email.toUpperCase()} `,
      password: person.password,
    });

    expect(member.email).toBe(person.email);
  });

  it('recusa senha errada', async () => {
    const person = await newSignedInPerson();

    await expect(
      anonymousCore().auth.signIn({ email: person.email, password: 'senha-errada' }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'E-mail ou senha incorretos.',
    });
  });

  it('depois de sair, a loja deixa de ser acessível', async () => {
    const person = await newSignedInPerson();
    await person.core.store.createStore({
      name: 'Doces da Júlia',
      pixKey: 'julia@example.com',
      city: 'Betim',
    });
    const changes: (string | null)[] = [];
    const unsubscribe = person.core.auth.onMemberChange((member) => {
      changes.push(member?.email ?? null);
    });

    await person.core.auth.signOut();
    unsubscribe();

    expect(changes).toContain(null);
    expect(await person.core.auth.getCurrentMember()).toBeNull();
    await expect(person.core.store.getMyStore()).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED',
    });
  });
});
