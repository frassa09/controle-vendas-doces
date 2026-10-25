import type { Credentials, Member, Store, StoreDetailsInput } from '@cvd/core';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { core } from '../core';

/**
 * Onde a pessoa está no primeiro acesso:
 * - loading: lendo a sessão guardada;
 * - signedOut: precisa entrar ou criar conta;
 * - noStore: entrou, mas ainda não tem loja (cria uma; depois, ou entra com convite);
 * - ready: tem loja;
 * - unavailable: não deu para saber a loja (sem internet, servidor fora).
 */
export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'noStore'; member: Member }
  | { status: 'ready'; member: Member; store: Store }
  | { status: 'unavailable'; member: Member; error: unknown };

interface SessionValue {
  state: SessionState;
  signIn(credentials: Credentials): Promise<void>;
  signUp(credentials: Credentials): Promise<void>;
  signOut(): Promise<void>;
  createStore(input: StoreDetailsInput): Promise<void>;
  /** Tenta de novo ler a loja (depois de uma falha de conexão). */
  reload(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  const resolveStore = useCallback(async (member: Member | null) => {
    if (!member) {
      setState({ status: 'signedOut' });
      return;
    }
    try {
      const store = await core.store.getMyStore();
      setState(store ? { status: 'ready', member, store } : { status: 'noStore', member });
    } catch (error) {
      setState({ status: 'unavailable', member, error });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void core.auth.getCurrentMember().then((member) => {
      if (active) void resolveStore(member);
    });
    // Sessão expirada ou encerrada em outro lugar: volta para a tela de entrar.
    const unsubscribe = core.auth.onMemberChange((member) => {
      if (active && !member) setState({ status: 'signedOut' });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [resolveStore]);

  const value = useMemo<SessionValue>(
    () => ({
      state,
      async signIn(credentials) {
        await resolveStore(await core.auth.signIn(credentials));
      },
      async signUp(credentials) {
        await resolveStore(await core.auth.signUp(credentials));
      },
      async signOut() {
        await core.auth.signOut();
        setState({ status: 'signedOut' });
      },
      async createStore(input) {
        if (state.status !== 'noStore') return;
        const store = await core.store.createStore(input);
        setState({ status: 'ready', member: state.member, store });
      },
      async reload() {
        if (state.status === 'signedOut' || state.status === 'loading') return;
        setState({ status: 'loading' });
        await resolveStore(state.member);
      },
    }),
    [state, resolveStore],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession precisa estar dentro de SessionProvider.');
  return value;
}
