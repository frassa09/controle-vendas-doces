import { CUSTOMER_LIMITS, type CustomerDetailsField, type CustomerDetailsInput } from '@cvd/core';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Checkbox, TextInput } from 'react-native-paper';
import { core } from '../core';
import { spacing } from '../theme/theme';
import { BackHeader } from '../ui/BackHeader';
import { FormError } from '../ui/FormError';
import { FormField, type FormFieldHandle } from '../ui/FormField';
import { FormScreen } from '../ui/FormScreen';
import { PrimaryButton } from '../ui/PrimaryButton';
import { ScreenHeader } from '../ui/ScreenHeader';
import { useCoreForm } from '../ui/useCoreForm';

export interface CustomerFormValues {
  name: string;
  whatsapp: string;
  reference: string;
  notes: string;
  pin: string;
  consented: boolean;
}

interface CustomerFormProps {
  title: string;
  lead?: string;
  initial: CustomerFormValues;
  submitLabel: string;
  onSubmit: (input: CustomerDetailsInput) => Promise<void>;
}

/** Cadastro e edição de cliente: os mesmos campos, na ordem em que se pergunta no balcão. */
export function CustomerForm({ title, lead, initial, submitLabel, onSubmit }: CustomerFormProps) {
  const form = useCoreForm<CustomerDetailsField>();
  const [values, setValues] = useState(initial);
  const whatsappRef = useRef<FormFieldHandle>(null);
  const referenceRef = useRef<FormFieldHandle>(null);
  const pinRef = useRef<FormFieldHandle>(null);
  const notesRef = useRef<FormFieldHandle>(null);

  const change = (field: CustomerDetailsField) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    form.clearFieldError(field);
  };
  const submit = () => form.submit(() => onSubmit(values));

  return (
    <FormScreen header={<BackHeader />}>
      <ScreenHeader title={title} {...(lead ? { lead } : {})} />

      <FormField
        label="Nome"
        value={values.name}
        onChangeText={change('name')}
        error={form.fieldErrors.name}
        hint="Como você chama o cliente."
        maxLength={CUSTOMER_LIMITS.name}
        autoCapitalize="words"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => whatsappRef.current?.focus()}
      />
      <FormField
        ref={whatsappRef}
        label="WhatsApp"
        value={values.whatsapp}
        onChangeText={change('whatsapp')}
        error={form.fieldErrors.whatsapp}
        hint="Com DDD. As cobranças e o link vão para esse número."
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={24}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => referenceRef.current?.focus()}
      />
      <FormField
        ref={referenceRef}
        label="Referência (opcional)"
        value={values.reference}
        onChangeText={change('reference')}
        error={form.fieldErrors.reference}
        hint="Apelido ou onde encontrar: portaria, escola, trabalho."
        maxLength={CUSTOMER_LIMITS.reference}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => pinRef.current?.focus()}
      />
      <FormField
        ref={pinRef}
        label="PIN"
        value={values.pin}
        onChangeText={(text) => {
          change('pin')(text.replace(/\D/g, ''));
        }}
        error={form.fieldErrors.pin}
        hint="4 números. O cliente usa para trocar pontos na página dele."
        keyboardType="number-pad"
        maxLength={CUSTOMER_LIMITS.pin}
        style={styles.pin}
        right={
          <TextInput.Icon
            icon="dice-5-outline"
            accessibilityLabel="Sortear outro PIN"
            onPress={() => {
              change('pin')(core.customers.suggestPin());
            }}
          />
        }
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => notesRef.current?.focus()}
      />
      <FormField
        ref={notesRef}
        label="Observações (opcional)"
        value={values.notes}
        onChangeText={change('notes')}
        error={form.fieldErrors.notes}
        hint="Gostos, combinados, dia de pagamento."
        maxLength={CUSTOMER_LIMITS.notes}
        multiline
        numberOfLines={3}
      />

      <View style={styles.consent}>
        <Checkbox.Item
          mode="android"
          position="leading"
          label="O cliente aceitou receber mensagens da loja pelo WhatsApp e ter estes dados guardados."
          labelVariant="bodyLarge"
          labelStyle={styles.consentLabel}
          style={styles.consentItem}
          status={values.consented ? 'checked' : 'unchecked'}
          onPress={() => {
            setValues((current) => ({ ...current, consented: !current.consented }));
          }}
        />
      </View>

      <FormError message={form.formError} />
      <PrimaryButton loading={form.submitting} onPress={submit}>
        {submitLabel}
      </PrimaryButton>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  pin: { fontSize: 22, letterSpacing: 6, fontVariant: ['tabular-nums'] },
  consent: { marginTop: spacing.xs, marginBottom: spacing.sm },
  consentItem: { paddingHorizontal: 0, alignItems: 'flex-start' },
  consentLabel: { textAlign: 'left', lineHeight: 23 },
});
