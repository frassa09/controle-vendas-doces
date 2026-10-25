import { argbFromHex, hexFromArgb, Hct, SchemeContent } from '@material/material-color-utilities';
import { configureFonts, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import { deriveStoreColors, materials, type StoreColors } from './storeColors';

/** Raios do DESIGN.md, aplicados por componente (o roundness do Paper é um só). */
export const radii = {
  campo: 14,
  botao: 16,
  cartao: 18,
} as const;

/** Espaçamentos do DESIGN.md. */
export const spacing = {
  xs: 4,
  sm: 6,
  gap: 10,
  md: 14,
  margem: 16,
  folha: 20,
  secao: 28,
  fim: 40,
} as const;

/** Altura das ações principais (DESIGN.md: alvos de 56dp). */
export const ACTION_HEIGHT = 56;

export interface AppTheme extends MD3Theme {
  store: StoreColors;
}

const nunito = (fontWeight: '400' | '600' | '700' | '800') => ({
  fontFamily: 'Nunito',
  fontWeight,
});
const caprasimo = { fontFamily: 'Caprasimo', fontWeight: '400' as const };

// Caprasimo só fala alto: display e headline. Todo o resto em Nunito.
const scale = configureFonts({
  config: {
    displayLarge: caprasimo,
    displayMedium: caprasimo,
    displaySmall: caprasimo,
    headlineLarge: caprasimo,
    headlineMedium: caprasimo,
    headlineSmall: caprasimo,
    titleLarge: nunito('700'),
    titleMedium: nunito('700'),
    titleSmall: nunito('700'),
    labelLarge: { ...nunito('800'), fontSize: 16, lineHeight: 22 },
    labelMedium: nunito('700'),
    labelSmall: nunito('700'),
    bodyLarge: { ...nunito('400'), fontSize: 16, lineHeight: 23 },
    bodyMedium: nunito('400'),
    bodySmall: nunito('400'),
  },
});
const fonts: MD3Theme['fonts'] = { ...scale, default: { ...scale.default, ...nunito('400') } };

const hex = (argb: number) => hexFromArgb(argb);

/**
 * Tema Material 3 do app a partir da cor da loja. O esquema MD3 completo vem do
 * SchemeContent (fiel à semente); os papéis de marca seguem as receitas do DESIGN.md:
 * ação em loja-forte com texto branco, papel como superfície, cacau como texto e
 * madeira nos contornos decorativos.
 */
export function buildTheme(seedHex?: string): AppTheme {
  const store = deriveStoreColors(seedHex);
  const scheme = new SchemeContent(Hct.fromInt(argbFromHex(store.loja)), false, 0);
  const surface = materials.papel;

  return {
    ...MD3LightTheme,
    fonts,
    roundness: 4,
    store,
    colors: {
      ...MD3LightTheme.colors,
      primary: store.forte,
      onPrimary: materials.campo,
      primaryContainer: store.suave,
      onPrimaryContainer: store.forte,
      secondary: hex(scheme.secondary),
      onSecondary: hex(scheme.onSecondary),
      secondaryContainer: hex(scheme.secondaryContainer),
      onSecondaryContainer: hex(scheme.onSecondaryContainer),
      tertiary: hex(scheme.tertiary),
      onTertiary: hex(scheme.onTertiary),
      tertiaryContainer: hex(scheme.tertiaryContainer),
      onTertiaryContainer: hex(scheme.onTertiaryContainer),
      background: surface,
      onBackground: materials.cacau,
      surface,
      onSurface: materials.cacau,
      surfaceVariant: store.parede,
      onSurfaceVariant: materials.cacau2,
      // madeira-2 tem só 2,8:1 sobre papel; bordas de campo precisam de 3:1,
      // então o contorno funcional vem do esquema e a madeira fica decorativa.
      outline: hex(scheme.outline),
      outlineVariant: materials.madeira,
      inverseSurface: materials.cacau,
      inverseOnSurface: materials.papel,
      inversePrimary: hex(scheme.inversePrimary),
      error: hex(scheme.error),
      onError: hex(scheme.onError),
      errorContainer: hex(scheme.errorContainer),
      onErrorContainer: hex(scheme.onErrorContainer),
      shadow: materials.cacau,
      scrim: materials.cacau,
      backdrop: 'rgba(74, 46, 34, 0.45)',
      elevation: {
        level0: 'transparent',
        level1: tint(surface, store.forte, 0.05),
        level2: tint(surface, store.forte, 0.08),
        level3: tint(surface, store.forte, 0.11),
        level4: tint(surface, store.forte, 0.12),
        level5: tint(surface, store.forte, 0.14),
      },
    },
  };
}

/** Superfície com uma camada da cor primária por cima (elevação tonal do MD3). */
function tint(base: string, overlay: string, amount: number): string {
  const b = argbFromHex(base);
  const o = argbFromHex(overlay);
  const channel = (shift: number) => {
    const from = (b >> shift) & 0xff;
    const to = (o >> shift) & 0xff;
    return Math.round(from + (to - from) * amount);
  };
  const rgb = (channel(16) << 16) | (channel(8) << 8) | channel(0);
  return `#${rgb.toString(16).padStart(6, '0')}`;
}
