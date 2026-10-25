import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCore, createSupabaseClient, type Core } from '@cvd/core';
import Constants from 'expo-constants';
import { AppState } from 'react-native';

interface Extra {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  customerPageUrl?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

if (!extra.supabaseUrl || !extra.supabaseAnonKey) {
  throw new Error('SUPABASE_URL e SUPABASE_ANON_KEY não foram definidos no build (veja o README).');
}

/**
 * O único ponto de acesso a dados do app. Telas usam o core (pela sessão em
 * src/session), nunca o Supabase diretamente.
 */
export const core: Core = createCore({
  customerPageUrl: extra.customerPageUrl || undefined,
  supabase: createSupabaseClient({
    url: extra.supabaseUrl,
    anonKey: extra.supabaseAnonKey,
    storage: AsyncStorage,
  }),
});

// A sessão só se renova com o app em primeiro plano (recomendação do Supabase para RN).
AppState.addEventListener('change', (state) => {
  core.auth.setAutoRefresh(state === 'active');
});
