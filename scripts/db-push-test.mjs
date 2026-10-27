// Aplica as migrações de supabase/migrations ao projeto Supabase de TESTES.
// Uso: npm run db:push:test   (lê SUPABASE_ACCESS_TOKEN, SUPABASE_TEST_PROJECT_REF e
// SUPABASE_TEST_DB_PASSWORD do ambiente ou do .env da raiz).
// Produção nunca é tocada por este script.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const required = [
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_TEST_PROJECT_REF',
  'SUPABASE_TEST_DB_PASSWORD',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Variáveis ausentes: ${missing.join(', ')}`);
  process.exit(1);
}

const env = { ...process.env, SUPABASE_DB_PASSWORD: process.env.SUPABASE_TEST_DB_PASSWORD };

function supabase(...args) {
  const result = spawnSync('npx', ['supabase', ...args], { stdio: 'inherit', env, shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

supabase('link', '--project-ref', process.env.SUPABASE_TEST_PROJECT_REF);
supabase('db', 'push', '--linked', '--include-all');
