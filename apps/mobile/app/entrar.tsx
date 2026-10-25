import type { CredentialsField } from '@cvd/core';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSession } from '../src/session/SessionProvider';
import { spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { FormError } from '../src/ui/FormError';
import { FormField, type FormFieldHandle } from '../src/ui/FormField';
import { FormScreen } from '../src/ui/FormScreen';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useCoreForm } from '../src/ui/useCoreForm';

export default function SignInScreen() {
  const session = useSession();
  const theme = useAppTheme();
  const form = useCoreForm<CredentialsField>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<FormFieldHandle>(null);

  const signIn = () => form.submit(() => session.signIn({ email, password }));

  return (
    <FormScreen>
      <ScreenHeader title="Que bom te ver" lead="Entre para cuidar das vendas da loja." />

      <FormField
        label="E-mail"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          form.clearFieldError('email');
        }}
        error={form.fieldErrors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <FormField
        ref={passwordRef}
        label="Senha"
        secret
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          form.clearFieldError('password');
        }}
        error={form.fieldErrors.password}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={signIn}
      />

      <FormError message={form.formError} />
      <PrimaryButton loading={form.submitting} onPress={signIn}>
        Entrar
      </PrimaryButton>

      <View style={styles.footer}>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          Ainda não tem conta?
        </Text>
        <Link href="/criar-conta" asChild>
          <Button mode="text" labelStyle={styles.link} compact>
            Criar conta
          </Button>
        </Link>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: spacing.secao,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  link: { fontSize: 16, marginVertical: 14 },
});
