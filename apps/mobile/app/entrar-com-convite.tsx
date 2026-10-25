import { INVITE_CODE_LENGTH, type InviteCodeField } from '@cvd/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useSession } from '../src/session/SessionProvider';
import { spacing } from '../src/theme/theme';
import { FormError } from '../src/ui/FormError';
import { FormField } from '../src/ui/FormField';
import { FormScreen } from '../src/ui/FormScreen';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useCoreForm } from '../src/ui/useCoreForm';

/** Primeiro acesso sem loja: quem foi convidado digita o código e entra na loja. */
export default function JoinWithInviteScreen() {
  const session = useSession();
  const router = useRouter();
  const form = useCoreForm<InviteCodeField>();
  const [code, setCode] = useState('');

  const join = () => form.submit(() => session.joinWithInvite(code));

  return (
    <FormScreen>
      <ScreenHeader
        title="Entrar com convite"
        lead="Peça o código a quem já usa o app na loja. Ele fica em Configurações, no celular dessa pessoa."
      />

      <FormField
        label="Código do convite"
        value={code}
        onChangeText={(text) => {
          setCode(text.toUpperCase());
          form.clearFieldError('code');
        }}
        error={form.fieldErrors.code}
        hint="São 8 letras e números, como ABCD-2345."
        // Folga para o hífen e espaços que a pessoa digitar.
        maxLength={INVITE_CODE_LENGTH + 4}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        autoFocus
        style={styles.code}
        returnKeyType="done"
        onSubmitEditing={join}
      />

      <FormError message={form.formError} />
      <PrimaryButton loading={form.submitting} onPress={join}>
        Entrar na loja
      </PrimaryButton>

      <Button
        mode="text"
        labelStyle={styles.link}
        style={styles.back}
        disabled={form.submitting}
        onPress={() => {
          router.back();
        }}
      >
        Voltar e criar minha própria loja
      </Button>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 22, fontWeight: '800', letterSpacing: 3, fontVariant: ['tabular-nums'] },
  back: { marginTop: spacing.secao },
  link: { fontSize: 16, marginVertical: 14 },
});
