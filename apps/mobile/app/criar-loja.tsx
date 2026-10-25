import { STORE_LIMITS, type StoreDetailsField } from '@cvd/core';
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

/** Primeiro acesso sem loja: o dono cria a sua. */
export default function CreateStoreScreen() {
  const session = useSession();
  const theme = useAppTheme();
  const form = useCoreForm<StoreDetailsField>();
  const [name, setName] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [city, setCity] = useState('');
  const pixKeyRef = useRef<FormFieldHandle>(null);
  const cityRef = useRef<FormFieldHandle>(null);

  const email = session.state.status === 'noStore' ? session.state.member.email : '';
  const createStore = () => form.submit(() => session.createStore({ name, pixKey, city }));

  return (
    <FormScreen>
      <ScreenHeader
        title="Vamos montar sua loja"
        lead="O nome aparece para seus clientes. A chave Pix e a cidade vão nas cobranças, no Pix copia-e-cola."
      />

      <FormField
        label="Nome da loja"
        value={name}
        onChangeText={(text) => {
          setName(text);
          form.clearFieldError('name');
        }}
        error={form.fieldErrors.name}
        hint="Do jeito que seus clientes conhecem."
        maxLength={STORE_LIMITS.name}
        autoCapitalize="words"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => pixKeyRef.current?.focus()}
      />
      <FormField
        ref={pixKeyRef}
        label="Chave Pix"
        value={pixKey}
        onChangeText={(text) => {
          setPixKey(text);
          form.clearFieldError('pixKey');
        }}
        error={form.fieldErrors.pixKey}
        hint="E-mail, celular com +55, CPF, CNPJ ou chave aleatória."
        maxLength={STORE_LIMITS.pixKey}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => cityRef.current?.focus()}
      />
      <FormField
        ref={cityRef}
        label="Cidade"
        value={city}
        onChangeText={(text) => {
          setCity(text);
          form.clearFieldError('city');
        }}
        error={form.fieldErrors.city}
        hint="Onde a loja recebe os pagamentos."
        maxLength={STORE_LIMITS.city}
        autoCapitalize="words"
        autoComplete="postal-address-locality"
        returnKeyType="done"
        onSubmitEditing={createStore}
      />

      <FormError message={form.formError} />
      <PrimaryButton loading={form.submitting} onPress={createStore}>
        Criar loja
      </PrimaryButton>

      <View style={styles.footer}>
        <Text
          variant="bodyMedium"
          style={[styles.account, { color: theme.colors.onSurfaceVariant }]}
        >
          Entrou como {email}
        </Text>
        <Button mode="text" compact labelStyle={styles.link} onPress={() => session.signOut()}>
          Sair
        </Button>
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
  account: { fontWeight: '600' },
  link: { fontSize: 16, marginVertical: 14 },
});
