import { CoreError } from '../errors';

/** Variáveis que o texto-modelo de cobrança aceita, entre chaves: {nome}. */
export const COLLECTION_VARIABLES = ['nome', 'itens', 'total', 'pix', 'link'] as const;
export type CollectionVariable = (typeof COLLECTION_VARIABLES)[number];

export const COLLECTION_TEMPLATE_MAX = 1500;

/** O tom da casa (PRODUCT.md): carinhoso, de quem conhece o cliente pelo nome. */
export const DEFAULT_COLLECTION_TEMPLATE = `Oi, {nome}! Tudo bem por aí?

Passando com todo carinho só pra lembrar dos docinhos que ficaram pendentes:

{itens}

Total: {total}

Se ficar mais fácil, dá pra pagar por Pix: é só copiar o código abaixo e colar no app do seu banco (o valor já vai certinho).

{pix}

Aqui está o seu cantinho, com tudo direitinho: {link}

Qualquer coisa é só me chamar. Um abraço!`;

const variablePattern = /\{(\w+)\}/g;

function isVariable(name: string): name is CollectionVariable {
  return (COLLECTION_VARIABLES as readonly string[]).includes(name);
}

/** Normaliza (trim) e valida um texto-modelo. Erros: INVALID_INPUT em `fieldErrors.template`. */
export function validateCollectionTemplate(text: string): string {
  const template = text.trim();
  let message: string | null = null;
  if (template === '') message = 'Escreva o texto da cobrança.';
  else if (template.length > COLLECTION_TEMPLATE_MAX) {
    message = `Use no máximo ${String(COLLECTION_TEMPLATE_MAX)} caracteres.`;
  } else {
    const unknown = [...template.matchAll(variablePattern)]
      .map((match) => match[1] ?? '')
      .filter((name) => !isVariable(name));
    if (unknown.length > 0) {
      const names = [...new Set(unknown)].map((name) => `{${name}}`).join(', ');
      const allowed = COLLECTION_VARIABLES.map((name) => `{${name}}`).join(', ');
      message = `Variável desconhecida: ${names}. Use ${allowed}.`;
    }
  }
  if (message !== null) {
    throw new CoreError<'template'>('INVALID_INPUT', { fieldErrors: { template: message } });
  }
  return template;
}

/**
 * Troca as variáveis pelos valores. Uma linha que tinha uma variável que ficou
 * vazia (ex.: sem link da página) some, para não sobrar "Aqui está: ".
 */
export function renderCollectionTemplate(
  template: string,
  values: Record<CollectionVariable, string>,
): string {
  const lines: string[] = [];
  for (const line of template.split('\n')) {
    let blanked = false;
    const rendered = line.replace(variablePattern, (whole, name: string) => {
      if (!isVariable(name)) return whole;
      if (values[name] === '') blanked = true;
      return values[name];
    });
    if (!blanked) lines.push(rendered);
  }
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
