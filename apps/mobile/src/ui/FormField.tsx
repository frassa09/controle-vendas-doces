import { useState, type Ref } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';
import { HelperText, TextInput, type TextInputProps } from 'react-native-paper';
import { radii } from '../theme/theme';

/** O que dá para fazer com o campo por ref (ex.: focar o próximo campo). */
export type FormFieldHandle = TextInputInstance;

type FormFieldProps = Omit<TextInputProps, 'error' | 'mode' | 'label' | 'ref'> & {
  label: string;
  /** Mensagem de erro do campo (vinda do core). */
  error?: string | undefined;
  /** Dica mostrada enquanto não há erro. */
  hint?: string;
  /** Campo de senha, com o botão de mostrar/ocultar. */
  secret?: boolean;
  ref?: Ref<FormFieldHandle>;
};

/**
 * Campo de formulário com rótulo, dica e erro. O espaço da mensagem é reservado
 * para o layout não pular quando um erro aparece (DESIGN.md: Inputs / Error).
 */
export function FormField({ error, hint, secret = false, label, ref, ...input }: FormFieldProps) {
  const [hidden, setHidden] = useState(true);
  const message = error ?? hint;

  return (
    <View>
      <TextInput
        ref={ref}
        mode="outlined"
        label={label}
        error={Boolean(error)}
        outlineStyle={styles.outline}
        style={styles.input}
        secureTextEntry={secret && hidden}
        right={
          secret ? (
            <TextInput.Icon
              icon={hidden ? 'eye-outline' : 'eye-off-outline'}
              accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}
              onPress={() => {
                setHidden((value) => !value);
              }}
            />
          ) : undefined
        }
        {...input}
      />
      <HelperText type={error ? 'error' : 'info'} visible style={styles.helper}>
        {message ?? ''}
      </HelperText>
    </View>
  );
}

const styles = StyleSheet.create({
  outline: { borderRadius: radii.campo },
  input: { fontSize: 17 },
  helper: { minHeight: 28, fontSize: 14 },
});
