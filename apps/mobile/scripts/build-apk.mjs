// Gera o APK de release localmente (Windows, macOS ou Linux).
//   npm run apk -w @cvd/mobile                 -> arm64-v8a (celulares)
//   npm run apk -w @cvd/mobile -- --emulator   -> arm64-v8a + x86_64 (também roda no emulador)
// Requer JDK 17 (JAVA_HOME) e Android SDK (ANDROID_HOME). O app aponta para o projeto
// Supabase de PRODUÇÃO: SUPABASE_URL e SUPABASE_ANON_KEY no .env da raiz.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootEnv = resolve(appDir, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

for (const name of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JAVA_HOME', 'ANDROID_HOME']) {
  if (!process.env[name]) {
    console.error(`Variável ${name} ausente (veja o README).`);
    process.exit(1);
  }
}

const architectures = process.argv.includes('--emulator') ? 'arm64-v8a,x86_64' : 'arm64-v8a';
const windows = process.platform === 'win32';

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: windows });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], appDir);
run(
  windows ? 'gradlew.bat' : './gradlew',
  ['assembleRelease', `-PreactNativeArchitectures=${architectures}`],
  join(appDir, 'android'),
);

console.log(`\nAPK: ${join(appDir, 'android/app/build/outputs/apk/release/app-release.apk')}`);
