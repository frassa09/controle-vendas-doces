import { formatCents, isCoreError } from '@cvd/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Divider, List, Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../../src/core';
import { methodLabel, whenFormat } from '../../src/payments/debt';
import { useWho } from '../../src/session/useWho';
import { radii, spacing } from '../../src/theme/theme';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { BackHeader } from '../../src/ui/BackHeader';
import { ConfirmDialog } from '../../src/ui/ConfirmDialog';
import { LoadingState } from '../../src/ui/LoadingState';
import { useFocusQuery } from '../../src/ui/useFocusQuery';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const failMessage = (error: unknown) =>
  isCoreError(error) ? error.message : 'Algo deu errado. Tente de novo.';

/**
 * Detalhe de um pagamento (de dívida ou o pago na hora de uma venda). Enquanto
 * ativo, pode ser cancelado; cancelado, continua aqui marcado como tal.
 */
export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const who = useWho();
  const load = useCallback(async () => {
    const payment = await core.payments.getPayment(id);
    const customer =
      payment.customerId === null ? null : await core.customers.getCustomer(payment.customerId);
    return { payment, customer };
  }, [id]);
  const query = useFocusQuery(load);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!query.data) return <LoadingState query={query} />;
  const { payment, customer } = query.data;
  const active = payment.status === 'active';
  // Pagamento de venda avulsa só se desfaz cancelando a venda.
  const walkIn = customer === null;
  const muted = { color: theme.colors.onSurfaceVariant };
  const divider = <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />;
  const cardStyle = [
    styles.card,
    { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant },
  ];
  const valueStyle = [styles.value, { color: theme.colors.onSurface }];

  const cancel = async () => {
    setCancelling(true);
    try {
      await core.payments.cancelPayment(payment.id);
      setConfirming(false);
      setNotice('Pagamento cancelado. O valor voltou para o saldo devedor.');
      await query.reload();
    } catch (error) {
      setConfirming(false);
      setNotice(failMessage(error));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <BackHeader title="Pagamento">
        {active && !walkIn ? (
          <Appbar.Action
            icon="close-circle-outline"
            accessibilityLabel="Cancelar pagamento"
            onPress={() => {
              setConfirming(true);
            }}
          />
        ) : null}
      </BackHeader>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.fim }]}
      >
        <Text variant="bodyLarge" style={[styles.who, muted]}>
          {customer ? `${customer.name} pagou` : 'Venda avulsa'} · {methodLabel[payment.method]}
        </Text>
        <Text
          variant="displaySmall"
          accessibilityRole="header"
          accessibilityLabel={`${formatCents(payment.amountCents)}${active ? '' : ', pagamento cancelado'}`}
          style={[
            styles.total,
            active
              ? { color: theme.colors.primary }
              : { color: theme.colors.onSurfaceVariant, textDecorationLine: 'line-through' },
          ]}
        >
          {formatCents(payment.amountCents)}
        </Text>

        {!active ? (
          <View
            style={[
              styles.banner,
              { backgroundColor: theme.colors.errorContainer, borderColor: theme.colors.error },
            ]}
          >
            <Text
              variant="titleMedium"
              style={[styles.bannerTitle, { color: theme.colors.onErrorContainer }]}
            >
              Pagamento cancelado
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onErrorContainer }}>
              {payment.cancelledAt
                ? `Em ${whenFormat.format(new Date(payment.cancelledAt))}${
                    payment.cancelledBy ? `, por ${who(payment.cancelledBy)}` : ''
                  }. `
                : ''}
              Continua no histórico, mas não abate o saldo devedor.
            </Text>
          </View>
        ) : null}

        <View style={cardStyle}>
          {payment.saleId !== null ? (
            <List.Item
              title="Pago na hora de uma venda"
              description="Toque para ver a venda."
              left={(props) => <List.Icon {...props} icon="basket-outline" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => {
                router.push({ pathname: '/vendas/[id]', params: { id: payment.saleId ?? '' } });
              }}
              titleStyle={styles.labelTitle}
              descriptionStyle={muted}
            />
          ) : (
            <List.Item
              title="Pagamento de dívida"
              description="Quita primeiro as compras em aberto mais antigas."
              left={(props) => <List.Icon {...props} icon="cash-check" />}
              titleStyle={styles.labelTitle}
              descriptionStyle={muted}
              descriptionNumberOfLines={2}
            />
          )}
          {customer ? (
            <>
              {divider}
              <List.Item
                title="Cliente"
                description={customer.name}
                left={(props) => <List.Icon {...props} icon="account-outline" />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => {
                  router.push({ pathname: '/clientes/[id]', params: { id: customer.id } });
                }}
                titleStyle={styles.labelTitle}
                descriptionStyle={valueStyle}
              />
            </>
          ) : null}
          {divider}
          <List.Item
            title="Registrado por"
            description={capitalize(who(payment.recordedBy))}
            left={(props) => <List.Icon {...props} icon="account-edit-outline" />}
            titleStyle={styles.labelTitle}
            descriptionStyle={valueStyle}
          />
          {divider}
          <List.Item
            title="Quando"
            description={whenFormat.format(new Date(payment.createdAt))}
            left={(props) => <List.Icon {...props} icon="clock-outline" />}
            titleStyle={styles.labelTitle}
            descriptionStyle={valueStyle}
          />
        </View>

        {active && walkIn ? (
          <Text variant="bodyMedium" style={[styles.hint, muted]}>
            Este pagamento é de uma venda avulsa. Para desfazer, cancele a venda.
          </Text>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={confirming}
        title="Cancelar este pagamento?"
        message={`Os ${formatCents(payment.amountCents)} voltam para o saldo devedor${
          customer ? ` de ${customer.name}` : ''
        }. A compra que ele quitava volta a ficar em aberto e os pontos dela são estornados. O pagamento continua no histórico como cancelado.`}
        confirmLabel="Cancelar pagamento"
        dismissLabel="Manter"
        busy={cancelling}
        onConfirm={() => void cancel()}
        onDismiss={() => {
          setConfirming(false);
        }}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.folha,
    paddingTop: spacing.xs,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  who: { fontWeight: '700' },
  total: { lineHeight: 52, marginTop: spacing.xs },
  banner: {
    marginTop: spacing.gap,
    padding: spacing.margem,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    gap: spacing.xs,
  },
  bannerTitle: { fontWeight: '800' },
  card: {
    marginTop: spacing.gap,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  labelTitle: { fontSize: 14, fontWeight: '700' },
  value: { fontSize: 17, marginTop: 2 },
  hint: { marginTop: spacing.margem, fontWeight: '600' },
});
