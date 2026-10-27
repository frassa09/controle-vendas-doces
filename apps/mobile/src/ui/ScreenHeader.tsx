import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/theme';

/** Título da tela (Caprasimo, em loja-forte) e a frase que explica o passo. */
export function ScreenHeader({ title, lead }: { title: string; lead?: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.header}>
      <Text
        variant="headlineLarge"
        accessibilityRole="header"
        style={{ color: theme.colors.primary }}
      >
        {title}
      </Text>
      {lead ? (
        <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
          {lead}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.gap, marginBottom: spacing.secao },
  lead: { fontWeight: '600', lineHeight: 25 },
});
