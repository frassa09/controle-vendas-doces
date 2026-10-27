import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { radii, spacing } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeProvider';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  /** Texto do botão que confirma (ex.: "Cancelar venda"). */
  confirmLabel: string;
  /** Texto do botão que desiste. */
  dismissLabel?: string;
  busy?: boolean;
  /** danger (padrão): o botão que confirma fica na cor de erro. */
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * Confirmação de uma ação que muda o histórico (corrigir ou cancelar venda,
 * cancelar pagamento). Desistir é sempre o caminho mais fácil.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  dismissLabel = 'Voltar',
  busy = false,
  tone = 'danger',
  onConfirm,
  onDismiss,
}: ConfirmDialogProps) {
  const theme = useAppTheme();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={busy ? undefined : onDismiss} style={styles.dialog}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {message}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={busy}>
            {dismissLabel}
          </Button>
          <Button
            mode="contained"
            buttonColor={tone === 'danger' ? theme.colors.error : theme.colors.primary}
            textColor={tone === 'danger' ? theme.colors.onError : theme.colors.onPrimary}
            onPress={onConfirm}
            loading={busy}
            disabled={busy}
            style={styles.confirm}
          >
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radii.cartao },
  confirm: { borderRadius: radii.botao, paddingHorizontal: spacing.sm },
});
