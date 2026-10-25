import { formatCents, formatWhatsApp, type CustomerBalance } from '@cvd/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Divider, List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../../../src/core';
import { dayFormat, debtSinceText } from '../../../src/payments/debt';
import { radii, spacing } from '../../../src/theme/theme';
import { useAppTheme } from '../../../src/theme/ThemeProvider';
import { BackHeader } from '../../../src/ui/BackHeader';
import { LoadingState } from '../../../src/ui/LoadingState';
import { PrimaryButton } from '../../../src/ui/PrimaryButton';
import { useFocusQuery } from '../../../src/ui/useFocusQuery';

/** Perfil do cliente: saldo devedor, contato, PIN e consentimento. */
export default function CustomerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const load = useCallback(
    () => Promise.all([core.customers.getCustomer(id), core.payments.getCustomerBalance(id)]),
    [id],
  );
  const query = useFocusQuery(load);

  if (!query.data) return <LoadingState query={query} />;
  const [customer, balance] = query.data;
  const valueStyle = [styles.itemValue, { color: theme.colors.onSurface }];
  const divider = <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <BackHeader>
        <Appbar.Action
          icon="pencil-outline"
          accessibilityLabel="Editar cliente"
          onPress={() => {
            router.push({ pathname: '/clientes/[id]/editar', params: { id: customer.id } });
          }}
        />
      </BackHeader>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.fim }]}
      >
        <Text
          variant="headlineLarge"
          accessibilityRole="header"
          style={{ color: theme.colors.primary }}
        >
          {customer.name}
        </Text>
        {customer.reference ? (
          <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
            {customer.reference}
          </Text>
        ) : null}

        <DebtCard balance={balance} customerId={customer.id} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.elevation.level1,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <List.Item
            title="WhatsApp"
            description={formatWhatsApp(customer.whatsapp)}
            left={(props) => <List.Icon {...props} icon="whatsapp" />}
            titleStyle={styles.itemTitle}
            descriptionStyle={valueStyle}
          />
          {divider}
          <List.Item
            title="PIN"
            description={customer.pin}
            accessibilityLabel={`PIN ${customer.pin.split('').join(' ')}`}
            left={(props) => <List.Icon {...props} icon="lock-outline" />}
            titleStyle={styles.itemTitle}
            descriptionStyle={[styles.pin, { color: theme.colors.onSurface }]}
          />
          {divider}
          <List.Item
            title="Consentimento (LGPD)"
            description={
              customer.consentAt
                ? `Aceitou em ${dayFormat.format(new Date(customer.consentAt))}`
                : 'Não registrado'
            }
            left={(props) => (
              <List.Icon
                {...props}
                icon={customer.consented ? 'check-circle-outline' : 'alert-circle-outline'}
              />
            )}
            titleStyle={styles.itemTitle}
            descriptionStyle={valueStyle}
          />
          {customer.notes ? (
            <>
              {divider}
              <List.Item
                title="Observações"
                description={customer.notes}
                descriptionNumberOfLines={0}
                left={(props) => <List.Icon {...props} icon="note-text-outline" />}
                titleStyle={styles.itemTitle}
                descriptionStyle={valueStyle}
              />
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** Saldo devedor e as compras ainda em aberto, das mais antigas para as mais novas. */
function DebtCard({ balance, customerId }: { balance: CustomerBalance; customerId: string }) {
  const router = useRouter();
  const theme = useAppTheme();
  const open = balance.sales.filter((sale) => sale.remainingCents > 0);
  const owes = balance.balanceCents > 0;
  const muted = { color: theme.colors.onSurfaceVariant };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.elevation.level1,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.debtHeader}>
        <Text variant="labelLarge" style={muted}>
          Saldo devedor
        </Text>
        <Text
          variant="displaySmall"
          accessibilityLabel={
            owes ? `Saldo devedor ${formatCents(balance.balanceCents)}` : 'Não deve nada'
          }
          style={[
            styles.debtValue,
            { color: owes ? theme.colors.primary : theme.colors.onSurface },
          ]}
        >
          {formatCents(balance.balanceCents)}
        </Text>
        <Text variant="bodyMedium" style={[styles.debtSince, muted]}>
          {debtSinceText(balance) ?? 'Nada em aberto.'}
        </Text>
      </View>

      {open.map((sale) => (
        <View key={sale.saleId}>
          <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
          <List.Item
            title={`Compra de ${dayFormat.format(new Date(sale.createdAt))}`}
            description={
              sale.status === 'partial'
                ? `Pago ${formatCents(sale.paidCents)} de ${formatCents(sale.totalCents)}`
                : `Nada pago de ${formatCents(sale.totalCents)}`
            }
            right={() => (
              <Text variant="titleMedium" style={styles.openValue}>
                {formatCents(sale.remainingCents)}
              </Text>
            )}
            onPress={() => {
              router.push({ pathname: '/vendas/[id]', params: { id: sale.saleId } });
            }}
            titleStyle={styles.itemTitle}
            descriptionStyle={muted}
          />
        </View>
      ))}

      {owes ? (
        <View style={styles.debtAction}>
          <PrimaryButton
            icon="cash-check"
            onPress={() => {
              router.push({ pathname: '/clientes/[id]/pagamento', params: { id: customerId } });
            }}
          >
            Registrar pagamento
          </PrimaryButton>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.folha,
    paddingTop: spacing.gap,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  lead: { marginTop: spacing.gap, fontWeight: '600' },
  card: {
    marginTop: spacing.secao,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  itemTitle: { fontSize: 14, fontWeight: '700' },
  debtHeader: { padding: spacing.margem },
  debtValue: { lineHeight: 52, marginTop: spacing.xs },
  debtSince: { fontWeight: '600' },
  openValue: { alignSelf: 'center', fontWeight: '800' },
  debtAction: { padding: spacing.margem, paddingTop: spacing.xs },
  itemValue: { fontSize: 17, marginTop: 2 },
  pin: {
    fontFamily: 'Caprasimo',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 6,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});
