import {
  formatCents,
  isCoreError,
  parseCents,
  type Customer,
  type CustomerBalance,
  type PaymentField,
  type PaymentMethod,
  type RecordedPayment,
} from '@cvd/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { core } from '../../../src/core';
import { centsText, debtSinceText, methodLabel } from '../../../src/payments/debt';
import { radii, spacing } from '../../../src/theme/theme';
import { useAppTheme } from '../../../src/theme/ThemeProvider';
import { BackHeader } from '../../../src/ui/BackHeader';
import { FormError } from '../../../src/ui/FormError';
import { FormField } from '../../../src/ui/FormField';
import { FormScreen } from '../../../src/ui/FormScreen';
import { LoadingState } from '../../../src/ui/LoadingState';
import { PrimaryButton } from '../../../src/ui/PrimaryButton';
import { ScreenHeader } from '../../../src/ui/ScreenHeader';
import { useCoreForm } from '../../../src/ui/useCoreForm';
import { useFocusQuery } from '../../../src/ui/useFocusQuery';

/**
 * Registrar um pagamento do cliente, total ou parcial. O valor já vem com o saldo
 * inteiro (o caso mais comum); para pagamento parcial, basta digitar o recebido.
 */
export default function RecordPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(
    () => Promise.all([core.customers.getCustomer(id), core.payments.getCustomerBalance(id)]),
    [id],
  );
  // Lê uma vez só: voltar ao foco não pode apagar o valor digitado.
  const query = useFocusQuery(load, { once: true });
  const [recorded, setRecorded] = useState<RecordedPayment | null>(null);

  if (!query.data) return <LoadingState query={query} />;
  const [customer, balance] = query.data;
  if (recorded) return <Recorded customer={customer} recorded={recorded} />;
  return <PaymentForm customer={customer} balance={balance} onRecorded={setRecorded} />;
}

function PaymentForm({
  customer,
  balance,
  onRecorded,
}: {
  customer: Customer;
  balance: CustomerBalance;
  onRecorded: (recorded: RecordedPayment) => void;
}) {
  const router = useRouter();
  const theme = useAppTheme();
  const form = useCoreForm<PaymentField>();
  const [amount, setAmount] = useState(() => centsText(balance.balanceCents));
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const owes = balance.balanceCents > 0;
  const cents = parseCents(amount);
  const partial = cents !== null && cents > 0 && cents < balance.balanceCents;

  const save = () =>
    form.submit(async () => {
      const recorded = await core.payments.recordPayment({
        customerId: customer.id,
        amountCents: parseCents(amount) ?? Number.NaN,
        method,
      });
      onRecorded(recorded);
    });

  if (!owes) {
    return (
      <FormScreen header={<BackHeader />}>
        <ScreenHeader
          title="Nada a receber"
          lead={`${customer.name} não tem saldo devedor. Vendas fiado entram aqui.`}
        />
        <PrimaryButton
          icon="arrow-left"
          onPress={() => {
            router.back();
          }}
        >
          Voltar ao perfil
        </PrimaryButton>
      </FormScreen>
    );
  }

  return (
    <FormScreen header={<BackHeader />}>
      <ScreenHeader
        title="Registrar pagamento"
        lead={`${customer.name} deve ${formatCents(balance.balanceCents)}. ${
          debtSinceText(balance) ?? ''
        }.`}
      />

      <FormField
        label="Valor recebido"
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          form.clearFieldError('amountCents');
        }}
        error={form.fieldErrors.amountCents}
        hint={
          partial
            ? `Pagamento parcial: fica faltando ${formatCents(balance.balanceCents - cents)}.`
            : 'Recebeu só uma parte? Digite o valor recebido.'
        }
        left={<TextInput.Affix text="R$" />}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />

      <Text variant="titleMedium" accessibilityRole="header" style={styles.label}>
        Como pagou
      </Text>
      <SegmentedButtons
        value={method}
        onValueChange={(value) => {
          setMethod(value);
          form.clearFieldError('method');
        }}
        buttons={[
          { value: 'pix', label: 'Pix', icon: 'qrcode' },
          { value: 'cash', label: 'Dinheiro', icon: 'cash' },
        ]}
      />
      <HelperText type="error" visible={Boolean(form.fieldErrors.method)}>
        {form.fieldErrors.method ?? ''}
      </HelperText>

      <Text variant="bodyMedium" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
        O pagamento quita primeiro as compras mais antigas.
      </Text>

      <View style={styles.actions}>
        <FormError message={form.formError} />
        <PrimaryButton
          icon="cash-check"
          onPress={save}
          loading={form.submitting}
          disabled={form.submitting}
        >
          Registrar pagamento
        </PrimaryButton>
      </View>
    </FormScreen>
  );
}

/** Confirmação: quanto entrou e como ficou o saldo. */
function Recorded({ customer, recorded }: { customer: Customer; recorded: RecordedPayment }) {
  const router = useRouter();
  const theme = useAppTheme();
  const { payment, balance } = recorded;
  const settled = balance.balanceCents === 0;
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Opcional: a pessoa decide se manda o recibo pelo WhatsApp do cliente.
  const sendReceipt = async () => {
    if (sending) return;
    setSending(true);
    try {
      const receipt = await core.receipts.buildPaymentReceipt(payment.id);
      await Linking.openURL(receipt.whatsappUrl);
    } catch (error) {
      setNotice(isCoreError(error) ? error.message : 'Não deu para abrir o WhatsApp.');
    } finally {
      setSending(false);
    }
  };

  return (
    <FormScreen header={<BackHeader title="Pagamento registrado" />}>
      <Text variant="bodyLarge" style={[styles.who, { color: theme.colors.onSurfaceVariant }]}>
        {customer.name} pagou · {methodLabel[payment.method]}
      </Text>
      <Text
        variant="displaySmall"
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        style={[styles.amount, { color: theme.colors.primary }]}
      >
        {formatCents(payment.amountCents)}
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.elevation.level1,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {settled ? 'Conta quitada' : 'Ainda deve'}
        </Text>
        <Text variant="headlineMedium" style={styles.balance}>
          {settled ? 'Nada em aberto' : formatCents(balance.balanceCents)}
        </Text>
        {settled ? null : (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {debtSinceText(balance)}
          </Text>
        )}
      </View>

      <Button
        mode="outlined"
        icon="whatsapp"
        style={styles.receipt}
        contentStyle={styles.receiptContent}
        loading={sending}
        disabled={sending}
        onPress={() => void sendReceipt()}
      >
        Enviar recibo
      </Button>

      <PrimaryButton
        icon="account-outline"
        style={styles.done}
        onPress={() => {
          router.back();
        }}
      >
        Voltar ao perfil
      </PrimaryButton>
      <Snackbar
        visible={notice !== null}
        onDismiss={() => {
          setNotice(null);
        }}
        duration={5000}
        style={{ backgroundColor: theme.colors.inverseSurface }}
      >
        {notice ?? ''}
      </Snackbar>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.gap },
  note: { marginTop: spacing.xs },
  actions: { marginTop: 'auto', paddingTop: spacing.secao },
  who: { fontWeight: '700' },
  amount: { lineHeight: 52, marginTop: spacing.xs },
  card: {
    marginTop: spacing.secao,
    padding: spacing.margem,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    gap: spacing.xs,
  },
  balance: { marginTop: spacing.xs },
  receipt: { marginTop: spacing.secao, borderRadius: radii.botao },
  receiptContent: { minHeight: 48 },
  done: { marginTop: spacing.gap },
});
