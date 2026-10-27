import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { radii, spacing } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { FormError } from '../ui/FormError';
import { useBackup } from './useBackup';

/**
 * Lembrete semanal de backup na tela inicial: aparece depois de 7 dias sem exportar
 * e some quando a exportação é feita.
 */
export function BackupReminder({ storeId }: { storeId: string }) {
  const theme = useAppTheme();
  const backup = useBackup(storeId);

  if (!backup.due) return null;

  return (
    <View
      accessibilityRole="summary"
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons
            name="content-save-outline"
            size={22}
            color={theme.colors.onPrimaryContainer}
          />
        </View>
        <View style={styles.text}>
          <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            Hora de guardar uma cópia
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {backup.lastExportAt
              ? 'Já faz uma semana desde a última. Mande os dados da loja para o seu Drive, e-mail ou WhatsApp.'
              : 'Mande os dados da loja para o seu Drive, e-mail ou WhatsApp. Assim nada se perde.'}
          </Text>
        </View>
      </View>
      {backup.error ? <FormError message={backup.error} /> : null}
      <Button
        mode="outlined"
        icon="export-variant"
        loading={backup.exporting}
        disabled={backup.exporting}
        onPress={() => void backup.exportAll()}
        style={styles.button}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Exportar tudo
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.secao,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    paddingHorizontal: spacing.margem,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xs },
  title: { fontWeight: '800' },
  button: { borderRadius: radii.botao },
  buttonContent: { minHeight: 48 },
  buttonLabel: { fontSize: 16 },
});
