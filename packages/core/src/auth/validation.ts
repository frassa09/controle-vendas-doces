import { CoreError, type FieldErrors } from '../errors';

export interface Credentials {
  email: string;
  password: string;
}

export type CredentialsField = keyof Credentials;

export const MIN_PASSWORD_LENGTH = 6;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normaliza e valida e-mail e senha. Lança INVALID_INPUT com mensagens por campo. */
export function validateCredentials(input: Credentials, purpose: 'signIn' | 'signUp'): Credentials {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const fieldErrors: FieldErrors<CredentialsField> = {};

  if (email === '') fieldErrors.email = 'Informe seu e-mail.';
  else if (!emailPattern.test(email)) fieldErrors.email = 'Esse e-mail não parece válido.';

  if (password === '') fieldErrors.password = 'Informe sua senha.';
  else if (purpose === 'signUp' && password.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.password = `Use pelo menos ${String(MIN_PASSWORD_LENGTH)} caracteres.`;
  }

  if (Object.keys(fieldErrors).length > 0) throw new CoreError('INVALID_INPUT', { fieldErrors });
  return { email, password };
}
