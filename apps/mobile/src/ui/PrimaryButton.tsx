import { StyleSheet } from 'react-native';
import { Button, type ButtonProps } from 'react-native-paper';
import { ACTION_HEIGHT, radii } from '../theme/theme';

type PrimaryButtonProps = Omit<ButtonProps, 'mode'>;

/** A ação principal da tela: preenchida em loja-forte, 56dp, uma por tela. */
export function PrimaryButton({ loading, disabled, style, ...props }: PrimaryButtonProps) {
  return (
    <Button
      mode="contained"
      loading={loading}
      disabled={disabled ?? loading}
      style={[styles.button, style]}
      contentStyle={styles.content}
      labelStyle={styles.label}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: radii.botao },
  content: { minHeight: ACTION_HEIGHT },
  label: { fontSize: 17, lineHeight: 22 },
});
