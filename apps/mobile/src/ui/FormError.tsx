import { StyleSheet } from 'react-native';
import { HelperText } from 'react-native-paper';

/** Erro do formulário como um todo (credenciais, conexão), logo acima da ação. */
export function FormError({ message }: { message: string | null }) {
  return (
    <HelperText type="error" visible style={styles.text} accessibilityLiveRegion="polite">
      {message ?? ''}
    </HelperText>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, fontWeight: '700', minHeight: 30, paddingHorizontal: 0 },
});
