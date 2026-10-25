import { useMemo, type ReactNode } from 'react';
import { PaperProvider, useTheme } from 'react-native-paper';
import { buildTheme, type AppTheme } from './theme';

interface ThemeProviderProps {
  /** Cor da loja. Sem ela (antes de a loja existir ou sem cor escolhida), a cor padrão. */
  seedColor?: string | undefined;
  children: ReactNode;
}

/** Aplica o tema MD3 derivado da cor da loja. */
export function ThemeProvider({ seedColor, children }: ThemeProviderProps) {
  const theme = useMemo(() => buildTheme(seedColor), [seedColor]);
  return <PaperProvider theme={theme}>{children}</PaperProvider>;
}

export const useAppTheme = () => useTheme<AppTheme>();
