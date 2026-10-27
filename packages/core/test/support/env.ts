function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável ${name} ausente. Configure o projeto Supabase de testes no .env da raiz (veja .env.example).`,
    );
  }
  return value;
}

export const testEnv = {
  url: required('SUPABASE_TEST_URL'),
  anonKey: required('SUPABASE_TEST_ANON_KEY'),
  serviceRoleKey: required('SUPABASE_TEST_SERVICE_ROLE_KEY'),
};
