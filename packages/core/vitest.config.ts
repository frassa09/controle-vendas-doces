import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// As variáveis do projeto Supabase de TESTES vêm do .env da raiz do repositório
// (localmente) ou do ambiente (CI). Nunca do projeto de produção.
const env = loadEnv('test', '../..', 'SUPABASE_TEST_');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    maxWorkers: 2,
  },
});
