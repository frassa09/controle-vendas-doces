import { isCoreError } from '@cvd/core';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { spacing } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { BackHeader } from './BackHeader';

interface LoadingStateProps {
  query: { status: 'loading' | 'ready' | 'error'; error: unknown; reload(): Promise<void> };
}

/** Tela empilhada enquanto os dados não chegam, ou quando a leitura falhou. */
export function LoadingState({ query }: LoadingStateProps) {
  const theme = useAppTheme();
  const message = isCoreError(query.error)
    ? query.error.message
    : 'Não deu para carregar. Tente de novo.';

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <BackHeader />
      <View style={styles.center}>
        {query.status === 'error' ? (
          <>
            <Text
              variant="bodyLarge"
              style={[styles.message, { color: theme.colors.onSurfaceVariant }]}
            >
              {message}
            </Text>
            <Button mode="outlined" onPress={() => void query.reload()}>
              Tentar de novo
            </Button>
          </>
        ) : (
          <ActivityIndicator accessibilityLabel="Carregando" size="large" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.folha,
  },
  message: { textAlign: 'center', fontWeight: '600' },
});
