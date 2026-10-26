import { isCoreError, type CustomerView } from '@cvd/core';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Cantinho } from './cantinho/Cantinho';
import { Abrindo, LinkNaoEncontrado, SemConexao } from './cantinho/States';
import { Symbols } from './cantinho/Symbols';
import { getCore } from './core';

/** Cor padrão da loja quando ela não escolheu a sua (DESIGN.md). */
const DEFAULT_STORE_COLOR = '#D6336C';

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; view: CustomerView; arrived: number | null }
  | { status: 'notFound' }
  | { status: 'failed' };

/** O link da página é `<endereço>/c/<token>` (o mesmo que a cobrança manda). */
function tokenFromPath(pathname: string): string | null {
  const match = /^\/c\/([^/]+)\/?$/.exec(pathname);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/** Quantos pontos o cliente tinha na última visita (só neste aparelho). */
function lastSeenKey(token: string) {
  return `cantinho:visto:${token.slice(0, 16)}`;
}

/** O que esta aba já calculou (recarregar os dados não repete a chegada dos doces). */
const visitsThisTab = new Map<string, number | null>();

function rememberVisit(token: string, balance: number): number | null {
  const known = visitsThisTab.get(token);
  if (known !== undefined) return known;
  const arrived = readVisit(token, balance);
  visitsThisTab.set(token, arrived);
  return arrived;
}

function readVisit(token: string, balance: number): number | null {
  try {
    const previous = window.localStorage.getItem(lastSeenKey(token));
    window.localStorage.setItem(lastSeenKey(token), String(balance));
    if (previous === null) return null;
    const diff = balance - Number(previous);
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

/** Depois de gastar pontos na página, a próxima visita compara com o saldo novo. */
function rememberBalance(token: string, balance: number) {
  try {
    window.localStorage.setItem(lastSeenKey(token), String(balance));
  } catch {
    // Sem armazenamento: a chegada dos doces só não é lembrada.
  }
}

function applyStoreColor(color: string | null) {
  document.documentElement.style.setProperty('--loja', color ?? DEFAULT_STORE_COLOR);
  // A barra do navegador acompanha a parede.
  const wall = getComputedStyle(document.body).backgroundColor;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', wall);
}

async function fetchPage(token: string): Promise<PageState> {
  try {
    const view = await getCore().customerPage.getCustomerView(token);
    return { status: 'ready', view, arrived: rememberVisit(token, view.points.balance) };
  } catch (error) {
    return isCoreError(error) && error.code === 'LINK_NOT_FOUND'
      ? { status: 'notFound' }
      : { status: 'failed' };
  }
}

export function App() {
  const [token] = useState(() => tokenFromPath(window.location.pathname));
  const [state, setState] = useState<PageState>(() =>
    token ? { status: 'loading' } : { status: 'notFound' },
  );

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void fetchPage(token).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [token, attempt]);

  // Relê sem a tela de "abrindo": a página continua de pé durante e depois da troca.
  const refresh = useCallback(() => {
    if (!token) return;
    void getCore()
      .customerPage.getCustomerView(token)
      .then((view) => {
        rememberBalance(token, view.points.balance);
        setState((current) =>
          current.status === 'ready'
            ? { status: 'ready', view, arrived: current.arrived }
            : current,
        );
      })
      .catch(() => {
        // Falhou a releitura: fica o que já está na tela.
      });
  }, [token]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  const storeColor = state.status === 'ready' ? state.view.store.brandColor : null;
  useLayoutEffect(() => {
    applyStoreColor(storeColor);
  }, [storeColor]);

  useEffect(() => {
    if (state.status === 'ready') {
      const { customer, store } = state.view;
      document.title = `Cantinho de ${customer.firstName} · ${store.name}`;
    } else if (state.status === 'notFound') {
      document.title = 'Cantinho não encontrado';
    }
  }, [state]);

  return (
    <>
      <Symbols />
      {state.status === 'ready' ? (
        <Cantinho
          token={token ?? ''}
          view={state.view}
          onChanged={refresh}
          arrivedSinceLastVisit={state.arrived}
        />
      ) : state.status === 'notFound' ? (
        <LinkNaoEncontrado />
      ) : state.status === 'failed' ? (
        <SemConexao onRetry={retry} />
      ) : (
        <Abrindo />
      )}
    </>
  );
}
