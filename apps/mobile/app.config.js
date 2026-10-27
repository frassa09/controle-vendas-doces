// @ts-check
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

// O app lê o projeto Supabase de PRODUÇÃO das variáveis SUPABASE_URL e
// SUPABASE_ANON_KEY (chave pública). Localmente vêm do .env da raiz do monorepo.
const rootEnv = resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

/** @param {import('expo/config').ConfigContext} context */
module.exports = ({ config }) => ({
  ...config,
  name: 'Vendas de Doces',
  slug: 'controle-vendas-doces',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'cvd',
  userInterfaceStyle: 'light',
  platforms: ['android'],
  android: {
    package: 'com.cvd.loja',
    versionCode: 1,
    softwareKeyboardLayoutMode: 'resize',
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: '#FFFEFB' }],
    [
      'expo-font',
      {
        android: {
          fonts: [
            {
              fontFamily: 'Nunito',
              fontDefinitions: [
                { path: './assets/fonts/Nunito_400Regular.ttf', weight: 400 },
                { path: './assets/fonts/Nunito_600SemiBold.ttf', weight: 600 },
                { path: './assets/fonts/Nunito_700Bold.ttf', weight: 700 },
                { path: './assets/fonts/Nunito_800ExtraBold.ttf', weight: 800 },
              ],
            },
            {
              fontFamily: 'Caprasimo',
              fontDefinitions: [{ path: './assets/fonts/Caprasimo_400Regular.ttf', weight: 400 }],
            },
          ],
        },
      },
    ],
    './plugins/withReleaseSigning',
    './plugins/withModernCmake',
  ],
  experiments: { typedRoutes: true },
  extra: {
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
    customerPageUrl: process.env.CUSTOMER_PAGE_URL ?? '',
  },
});
