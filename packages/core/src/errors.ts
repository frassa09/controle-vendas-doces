/**
 * Erros que o core devolve às telas. Toda falha conhecida vira um CoreError com
 * um código estável (para a tela decidir o que fazer) e uma mensagem em pt-BR
 * pronta para mostrar ao usuário.
 */
export type CoreErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_AUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'EMAIL_CONFIRMATION_REQUIRED'
  | 'ALREADY_HAS_STORE'
  | 'INVITE_NOT_FOUND'
  | 'INVITE_ALREADY_USED'
  | 'FORBIDDEN'
  | 'CUSTOMER_NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'NETWORK'
  | 'UNEXPECTED';

const defaultMessages: Record<CoreErrorCode, string> = {
  INVALID_INPUT: 'Confira os campos destacados.',
  NOT_AUTHENTICATED: 'Sua sessão terminou. Entre de novo.',
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  EMAIL_ALREADY_REGISTERED: 'Já existe uma conta com esse e-mail. Tente entrar.',
  EMAIL_CONFIRMATION_REQUIRED: 'Confirme seu e-mail antes de entrar.',
  ALREADY_HAS_STORE: 'Você já faz parte de uma loja.',
  INVITE_NOT_FOUND: 'Não encontramos esse código. Confira as letras e os números.',
  INVITE_ALREADY_USED: 'Este código já foi usado. Peça um código novo para quem te convidou.',
  FORBIDDEN: 'Você não tem acesso a esses dados.',
  CUSTOMER_NOT_FOUND: 'Cliente não encontrado.',
  PRODUCT_NOT_FOUND: 'Produto não encontrado.',
  NETWORK: 'Sem conexão com o servidor. Confira a internet e tente de novo.',
  UNEXPECTED: 'Algo deu errado. Tente de novo.',
};

/** Mensagens por campo, para mostrar abaixo de cada campo do formulário. */
export type FieldErrors<Field extends string = string> = Partial<Record<Field, string>>;

export class CoreError<Field extends string = string> extends Error {
  readonly code: CoreErrorCode;
  readonly fieldErrors: FieldErrors<Field>;

  constructor(
    code: CoreErrorCode,
    options: { message?: string; fieldErrors?: FieldErrors<Field>; cause?: unknown } = {},
  ) {
    super(options.message ?? defaultMessages[code], { cause: options.cause });
    this.name = 'CoreError';
    this.code = code;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export function isCoreError(error: unknown): error is CoreError {
  return error instanceof CoreError;
}
