// Regera packages/core/src/db/database.types.ts a partir do projeto de TESTES
// (que recebe as mesmas migrações da produção). Rode depois de npm run db:push:test.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
const ref = process.env.SUPABASE_TEST_PROJECT_REF;
if (!ref || !process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('Variáveis ausentes: SUPABASE_ACCESS_TOKEN, SUPABASE_TEST_PROJECT_REF');
  process.exit(1);
}

const types = execSync(`npx supabase gen types typescript --project-id ${ref} --schema public`, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
mkdirSync('packages/core/src/db', { recursive: true });
writeFileSync('packages/core/src/db/database.types.ts', types);
execSync('npx prettier --write packages/core/src/db/database.types.ts', { stdio: 'inherit' });
