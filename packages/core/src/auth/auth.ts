import type { AuthError, User } from '@supabase/supabase-js';
import type { DbClient } from '../db/client';
import { CoreError } from '../errors';
import { validateCredentials, type Credentials } from './validation';

/** O usuário logado, do ponto de vista do app. */
export interface Member {
  id: string;
  email: string;
}

export interface AuthOperations {
  /** Cria a conta e já entra. */
  signUp(credentials: Credentials): Promise<Member>;
  signIn(credentials: Credentials): Promise<Member>;
  signOut(): Promise<void>;
  /** Quem está logado agora, ou null. Lê a sessão guardada (não vai à rede). */
  getCurrentMember(): Promise<Member | null>;
  /** Avisa a cada entrada ou saída. Devolve a função que cancela a inscrição. */
  onMemberChange(listener: (member: Member | null) => void): () => void;
  /**
   * Liga/desliga a renovação automática da sessão. O app chama com true quando
   * volta ao primeiro plano e com false quando vai para segundo plano.
   */
  setAutoRefresh(enabled: boolean): void;
}

export function createAuthOperations(db: DbClient): AuthOperations {
  return {
    async signUp(credentials) {
      const { email, password } = validateCredentials(credentials, 'signUp');
      const { data, error } = await db.auth.signUp({ email, password });
      if (error) throw fromAuthError(error);
      if (!data.user) throw new CoreError('UNEXPECTED');
      // Supabase devolve um usuário "fantasma" sem identidades quando o e-mail já existe.
      if (data.user.identities?.length === 0) throw new CoreError('EMAIL_ALREADY_REGISTERED');
      if (!data.session) throw new CoreError('EMAIL_CONFIRMATION_REQUIRED');
      return toMember(data.user);
    },

    async signIn(credentials) {
      const { email, password } = validateCredentials(credentials, 'signIn');
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw fromAuthError(error);
      return toMember(data.user);
    },

    async signOut() {
      const { error } = await db.auth.signOut();
      if (error) throw fromAuthError(error);
    },

    async getCurrentMember() {
      const { data } = await db.auth.getSession();
      return data.session ? toMember(data.session.user) : null;
    },

    onMemberChange(listener) {
      const { data } = db.auth.onAuthStateChange((_event, session) => {
        listener(session ? toMember(session.user) : null);
      });
      return () => {
        data.subscription.unsubscribe();
      };
    },

    setAutoRefresh(enabled) {
      void (enabled ? db.auth.startAutoRefresh() : db.auth.stopAutoRefresh());
    },
  };
}

function toMember(user: User): Member {
  return { id: user.id, email: user.email ?? '' };
}

function fromAuthError(error: AuthError): CoreError {
  switch (error.code) {
    case 'invalid_credentials':
      return new CoreError('INVALID_CREDENTIALS', { cause: error });
    case 'user_already_exists':
    case 'email_exists':
      return new CoreError('EMAIL_ALREADY_REGISTERED', { cause: error });
    case 'email_not_confirmed':
      return new CoreError('EMAIL_CONFIRMATION_REQUIRED', { cause: error });
    case 'weak_password':
      return new CoreError('INVALID_INPUT', {
        message: 'Escolha uma senha mais forte.',
        fieldErrors: { password: 'Use pelo menos 6 caracteres.' },
        cause: error,
      });
    case 'email_address_invalid':
      return new CoreError('INVALID_INPUT', {
        fieldErrors: { email: 'Esse e-mail não parece válido.' },
        cause: error,
      });
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new CoreError('UNEXPECTED', {
        message: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
        cause: error,
      });
    default:
      if (error.name === 'AuthRetryableFetchError') {
        return new CoreError('NETWORK', { cause: error });
      }
      return new CoreError('UNEXPECTED', { cause: error });
  }
}
