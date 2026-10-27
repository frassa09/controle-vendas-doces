import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/theme';

/**
 * Tela de formulário em coluna única: respeita as áreas do sistema (edge-to-edge)
 * e o teclado, e rola quando o conteúdo não cabe. Telas empilhadas passam o
 * `header` (ex.: BackHeader), que fica fixo acima da rolagem.
 */
export function FormScreen({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      {header}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: header ? spacing.gap : insets.top + spacing.fim,
            paddingBottom: insets.bottom + spacing.fim,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.folha,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
});
