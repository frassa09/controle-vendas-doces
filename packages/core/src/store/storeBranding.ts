import { CoreError, type FieldErrors } from '../errors';

/** Identidade visual da loja escolhida no app. null volta à aparência padrão. */
export interface StoreBrandingInput {
  /** Cor principal, "#RRGGBB" (aceita minúsculas e sem "#"). */
  brandColor: string | null;
  /** Texto de boas-vindas da página do cliente. Vazio vira null. */
  welcomeText: string | null;
}

export type StoreBrandingField = keyof StoreBrandingInput | 'logo';

/** Limites espelhados nas constraints de public.stores. */
export const BRANDING_LIMITS = {
  welcomeText: 160,
  /** Tamanho máximo do logo como data URL (~150 KB de imagem). */
  logoChars: 200_000,
} as const;

const HEX_COLOR = /^#?([0-9a-fA-F]{6})$/;
const LOGO_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

export function validateStoreBranding(input: StoreBrandingInput): StoreBrandingInput {
  const fieldErrors: FieldErrors<StoreBrandingField> = {};
  let brandColor: string | null = null;
  if (input.brandColor !== null && input.brandColor.trim() !== '') {
    const match = HEX_COLOR.exec(input.brandColor.trim());
    if (match?.[1]) brandColor = `#${match[1].toUpperCase()}`;
    else fieldErrors.brandColor = 'Escolha uma cor no formato #RRGGBB.';
  }
  const welcome = input.welcomeText?.trim() ?? '';
  if (welcome.length > BRANDING_LIMITS.welcomeText) {
    fieldErrors.welcomeText = `Use no máximo ${String(BRANDING_LIMITS.welcomeText)} caracteres.`;
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new CoreError<StoreBrandingField>('INVALID_INPUT', { fieldErrors });
  }
  return { brandColor, welcomeText: welcome === '' ? null : welcome };
}

/** Confere o logo (data URL png/jpeg/webp, pequeno). null remove o logo. */
export function validateStoreLogo(logo: string | null): string | null {
  if (logo === null) return null;
  if (!LOGO_DATA_URL.test(logo)) {
    throw new CoreError<StoreBrandingField>('INVALID_INPUT', {
      fieldErrors: { logo: 'Use uma imagem PNG, JPEG ou WebP.' },
    });
  }
  if (logo.length > BRANDING_LIMITS.logoChars) {
    throw new CoreError<StoreBrandingField>('INVALID_INPUT', {
      fieldErrors: { logo: 'Essa imagem é grande demais. Escolha uma menor.' },
    });
  }
  return logo;
}
