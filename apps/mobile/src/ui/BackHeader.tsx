import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Appbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeProvider';

/**
 * Barra do topo das telas empilhadas: voltar, um título curto opcional e ações à
 * direita. Fica na cor do papel, sem sombra, para não competir com o conteúdo.
 */
export function BackHeader({ title, children }: { title?: string; children?: ReactNode }) {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Appbar.Header
      style={{ backgroundColor: theme.colors.background }}
      statusBarHeight={insets.top}
    >
      <Appbar.BackAction
        accessibilityLabel="Voltar"
        onPress={() => {
          router.back();
        }}
      />
      <Appbar.Content title={title ?? ''} titleStyle={{ fontWeight: '800' }} />
      {children}
    </Appbar.Header>
  );
}
