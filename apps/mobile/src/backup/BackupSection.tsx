import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { dayFormat } from '../payments/debt';
import { radii, spacing } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { FormError } from '../ui/FormError';
import { useBackup } from './useBackup';

/** Seção de Configurações: exportar tudo e a data da última cópia. */
export function BackupSection({ storeId }: { storeId: string }) {
  const theme = useAppTheme();
  const backup = useBackup(storeId);

  return (
    <View>
      <Text
        variant="headlineSmall"
        accessibilityRole="header"
        style={[styles.heading, { color: theme.colors.primary }]}
      >
        Cópia dos dados
      </Text>
      <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
        Gera planilhas com tudo da loja: clientes, vendas, pagamentos, pontos e cupons. Guarde no
        Drive, no e-mail ou no WhatsApp. O PIN e o link dos clientes não vão junto.
      </Text>
      <Text
        variant="bodyMedium"
        style={[
          styles.last,
          { color: backup.due ? theme.colors.primary : theme.colors.onSurfaceVariant },
        ]}
      >
        {backup.lastExportAt
          ? `Última cópia neste celular: ${dayFormat.format(new Date(backup.lastExportAt))}`
          : 'Nenhuma cópia feita neste celular ainda.'}
      </Text>
      <FormError message={backup.error} />
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
  heading: { marginTop: spacing.secao },
  lead: { marginTop: spacing.gap, fontWeight: '600', lineHeight: 25 },
  last: { marginTop: spacing.md, fontWeight: '700' },
  button: { borderRadius: radii.botao },
  buttonContent: { minHeight: 56 },
  buttonLabel: { fontSize: 17, lineHeight: 22 },
});
