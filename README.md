# Controle de vendas de doces

App Android da loja (Expo), página web do cliente (Vite + React) e o pacote de domínio
`core`, que é a única porta para os dados. Backend no Supabase (plano gratuito). Spec
completa na issue #1; contexto de produto em [PRODUCT.md](PRODUCT.md) e sistema visual em
[DESIGN.md](DESIGN.md).

```
packages/core   @cvd/core   operações de negócio (loja, auth...) e testes de comportamento
apps/mobile     @cvd/mobile app Android (Expo SDK 58, expo-router, React Native Paper MD3)
apps/web        @cvd/web    página do cliente (o Cantinho)
supabase/       migrações (a única fonte do schema) e config da CLI
scripts/        aplicar migrações e gerar tipos a partir do projeto de testes
```

Requisitos: Node 22.13+ (ou 24.3+), npm 10. Para o APK: JDK 17 e Android SDK.

## Variáveis e os dois projetos Supabase

Há dois projetos Supabase: **produção** (usado pelo app) e **testes** (usado só pelos
testes automatizados). Copie `.env.example` para `.env` na raiz e preencha. O `.env`
nunca vai para o git.

| Variável                                                 | Projeto  | Para quê                                                            |
| -------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`                      | produção | Embutidas no app no build (chave pública; nunca a service role).    |
| `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`           | produção | Aplicar migrações em produção (feito pelo integrador após o merge). |
| `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`            | testes   | Testes do core, como usuário comum.                                 |
| `SUPABASE_TEST_SERVICE_ROLE_KEY`                         | testes   | Testes: criar e apagar usuários de teste. Só em testes/CI.          |
| `SUPABASE_TEST_PROJECT_REF`, `SUPABASE_TEST_DB_PASSWORD` | testes   | `npm run db:push:test` e `npm run db:types`.                        |
| `SUPABASE_ACCESS_TOKEN`                                  | conta    | Token pessoal da CLI (Dashboard > Account > Access Tokens).         |

Os valores ficam em Project Settings > API (URL e chaves) e Database (senha) de cada
projeto. Nos dois projetos, desligue "Confirm email" em Authentication > Providers >
Email: o SMTP embutido manda poucos e-mails por hora e o cadastro travaria.

## Migrações

O schema só muda por migração em `supabase/migrations`. Nunca altere tabelas pelo
dashboard.

```bash
npx supabase migration new <nome>   # cria o arquivo
npm run db:push:test                # aplica no projeto de TESTES
npm run db:types                    # regenera packages/core/src/db/database.types.ts
```

Produção recebe as mesmas migrações depois do merge:

```bash
npx supabase link --project-ref "$SUPABASE_PROJECT_REF" -p "$SUPABASE_DB_PASSWORD"
npx supabase db push --linked
```

## Checar tudo e rodar os testes

```bash
npm ci
npm run check    # tipos + lint + formatação + testes
npm test         # só os testes do core (contra o projeto de testes)
npm run format   # corrige a formatação
```

Os testes ficam em `packages/core/test` e usam só a interface pública do `core`, contra
o projeto Supabase de testes (sem Docker, sem banco local). Cada teste cria os próprios
usuários e a própria loja; os usuários são apagados ao fim de cada arquivo. O projeto de
testes precisa estar com as migrações da branch aplicadas (`npm run db:push:test`).

## Rodar o app

O app usa módulos nativos e fontes embutidas, então roda como build de desenvolvimento
(não no Expo Go), num emulador ou celular com depuração USB:

```bash
npm run android -w @cvd/mobile   # expo run:android: gera android/, compila e instala
npm start -w @cvd/mobile         # depois, só o bundler
```

`apps/mobile/android/` é gerado pelo `expo prebuild` e não vai para o git. A
configuração nativa mora em `apps/mobile/app.config.js` e `apps/mobile/plugins/`.

## Gerar o APK de release

Com `JAVA_HOME` apontando para o JDK 17 e `ANDROID_HOME` para o Android SDK, e com o
**CMake 3.31.6** instalado no SDK (Android Studio > SDK Manager > SDK Tools > CMake, marque
"Show Package Details"). O CMake padrão (3.22.1) falha no Windows com caminhos longos
("Filename longer than 260 characters"); o plugin `plugins/withModernCmake.js` faz todos
os módulos usarem o 3.31.6. No Windows, deixe também o suporte a caminhos longos ligado
(`LongPathsEnabled=1` no registro) e `git config --global core.longpaths true`.

```bash
npm run apk -w @cvd/mobile                # arm64-v8a (celulares)
npm run apk -w @cvd/mobile -- --emulator  # arm64-v8a + x86_64 (roda também no emulador)
```

O APK sai em `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` e
aponta para o Supabase de **produção** (`SUPABASE_URL` e `SUPABASE_ANON_KEY` do `.env`).
O primeiro build baixa NDK, CMake e Gradle (cerca de 1 GB) e demora.

Instalar no celular (Opções do desenvolvedor > Depuração USB):

```bash
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Ou envie o APK para o celular e abra o arquivo, permitindo instalar de fontes
desconhecidas.

### Chave de assinatura

Sem configuração, o APK sai assinado com a chave de debug, o que serve para testar. Para
distribuir, gere uma chave uma única vez e guarde-a (com backup) **fora do repositório**:
perder a chave impede atualizar o app já instalado.

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore ~/.android-keys/cvd-release.keystore \
  -alias cvd -keyalg RSA -keysize 2048 -validity 10000
```

E em `~/.gradle/gradle.properties`:

```
CVD_UPLOAD_STORE_FILE=C:/Users/<você>/.android-keys/cvd-release.keystore
CVD_UPLOAD_KEY_ALIAS=cvd
CVD_UPLOAD_STORE_PASSWORD=...
CVD_UPLOAD_KEY_PASSWORD=...
```

Trocar de chave de debug para a definitiva exige desinstalar o app antes
(`adb uninstall com.cvd.loja`).

## Página do cliente (web)

```bash
npm run dev -w @cvd/web
npm run build -w @cvd/web
```

Usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (públicas) em `apps/web/.env.local`.
O endereço da página é `<CUSTOMER_PAGE_URL>/c/<token do cliente>` (o mesmo que a cobrança
manda); qualquer outro caminho mostra "Não achamos esse cantinho".

A página não lê tabelas: tudo vem da edge function `customer-view`
(`supabase/functions/customer-view`, `verify_jwt = false`), que recebe o token e chama
`public.get_customer_page` com a service role. Ela precisa estar publicada no projeto
(sem Docker, o bundle é feito no servidor):

```bash
# testes (necessário para npm test)
npx supabase functions deploy customer-view --project-ref "$SUPABASE_TEST_PROJECT_REF" --use-api
# produção (o integrador, depois de aplicar as migrações)
npx supabase functions deploy customer-view --project-ref "$SUPABASE_PROJECT_REF" --use-api
```

Na Vercel: projeto com raiz `apps/web`, build `npm run build`, saída `dist`, variáveis
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` de produção. O `vercel.json` manda toda rota
para o `index.html` e desliga indexação e Referer (o link carrega um segredo).

## CI

`.github/workflows/ci.yml` roda tipos, lint, formatação e testes a cada push. Os testes
precisam destes **secrets do repositório** (Settings > Secrets and variables > Actions),
todos do projeto de **testes**:

- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_ANON_KEY`
- `SUPABASE_TEST_SERVICE_ROLE_KEY`

O CI não aplica migrações: rode `npm run db:push:test` antes de subir uma branch com
migração nova.
