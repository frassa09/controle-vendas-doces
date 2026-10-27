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
  | 'PRODUCT_INACTIVE'
  | 'SALE_NOT_FOUND'
  | 'PAYMENT_EXCEEDS_BALANCE'
  | 'LINK_NOT_FOUND'
  | 'NO_DEBT'
  | 'SALE_CANCELLED'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENTS_EXCEED_DEBT'
  | 'WALK_IN_SALE_PAYMENT'
  | 'PIN_INVALID'
  | 'PIN_LOCKED'
  | 'PRIZE_NOT_AVAILABLE'
  | 'INSUFFICIENT_POINTS'
  | 'COUPON_NOT_FOUND'
  | 'COUPON_ALREADY_DELIVERED'
  | 'NO_PRIZES_AVAILABLE'
  | 'SCRATCH_PLAY_NOT_FOUND'
  | 'PRIZE_ALREADY_CLAIMED'
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
  PRODUCT_INACTIVE: 'Um dos produtos foi desativado. Atualize a lista e tente de novo.',
  SALE_NOT_FOUND: 'Venda não encontrada.',
  PAYMENT_EXCEEDS_BALANCE: 'O valor passa do saldo devedor do cliente.',
  LINK_NOT_FOUND: 'Não encontramos este cantinho. Confira o link que a loja mandou.',
  NO_DEBT: 'Este cliente não deve nada.',
  SALE_CANCELLED: 'Esta venda foi cancelada e não pode mais ser alterada.',
  PAYMENT_NOT_FOUND: 'Pagamento não encontrado.',
  PAYMENT_CANCELLED: 'Este pagamento já foi cancelado.',
  PAYMENTS_EXCEED_DEBT:
    'Um pagamento de dívida do cliente já cobre esta compra. Cancele esse pagamento antes e registre de novo o valor certo.',
  WALK_IN_SALE_PAYMENT: 'Este pagamento é de uma venda avulsa. Para desfazer, cancele a venda.',
  PIN_INVALID: 'PIN errado. Confira os 4 números que a loja mandou.',
  PIN_LOCKED: 'Muitas tentativas com o PIN errado. Espere um pouco e tente de novo.',
  PRIZE_NOT_AVAILABLE: 'Esse doce não está mais disponível como prêmio. Escolha outro.',
  INSUFFICIENT_POINTS: 'Ainda não há pontos suficientes para essa troca.',
  COUPON_NOT_FOUND: 'Cupom não encontrado.',
  COUPON_ALREADY_DELIVERED: 'Este cupom já foi entregue.',
  NO_PRIZES_AVAILABLE: 'A loja ainda não separou os doces de prêmio. Pergunte por lá.',
  SCRATCH_PLAY_NOT_FOUND: 'Não encontramos essa raspadinha premiada.',
  PRIZE_ALREADY_CLAIMED: 'O prêmio dessa raspadinha já foi escolhido.',
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
