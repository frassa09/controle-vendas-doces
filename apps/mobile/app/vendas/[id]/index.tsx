import { formatCents, isCoreError } from '@cvd/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Divider, List, Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../../../src/core';
import { methodLabel, whenFormat } from '../../../src/payments/debt';
import { useWho } from '../../../src/session/useWho';
import { radii, spacing } from '../../../src/theme/theme';
import { useAppTheme } from '../../../src/theme/ThemeProvider';
import { BackHeader } from '../../../src/ui/BackHeader';
import { ConfirmDialog } from '../../../src/ui/ConfirmDialog';
import { LoadingState } from '../../../src/ui/LoadingState';
import { PrimaryButton } from '../../../src/ui/PrimaryButton';
import { useFocusQuery } from '../../../src/ui/useFocusQuery';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const failMessage = (error: unknown) =>
  isCoreError(error) ? error.message : 'Algo deu errado. Tente de novo.';

/**
 * Detalhe da venda: itens, pagamento, quem registrou e quando. Enquanto ativa,
 * pode ser editada ou cancelada; cancelada, continua aqui marcada como tal.
 */
export default function SaleDetailScreen() {
  const { id, nova } = useLocalSearchParams<{ id: string; nova?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const who = useWho();
  const load = useCallback(() => core.sales.getSale(id), [id]);
  const query = useFocusQuery(load);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!query.data) return <LoadingState query={query} />;
  const sale = query.data;
  const active = sale.status === 'active';
  const just = nova === '1' && active;
  const muted = { color: theme.colors.onSurfaceVariant };
  const divider = <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />;
  const cardStyle = [
    styles.card,
    { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant },
  ];
  // Fiado, ou paga na hora cujo pagamento foi cancelado: está na conta do cliente.
  const onAccount =
    active && sale.customer !== null && !sale.payments.some((p) => p.status === 'active');

  const cancel = async () => {
    setCancelling(true);
    try {
      await core.sales.cancelSale(sale.id);
      setConfirming(false);
      setNotice('Venda cancelada. Ela continua no histórico.');
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
      <BackHeader title={just ? 'Venda registrada' : 'Venda'}>
        {active ? (
          <>
            <Appbar.Action
              icon="pencil-outline"
              accessibilityLabel="Editar venda"
              onPress={() => {
                router.push({ pathname: '/venda', params: { editar: sale.id } });
              }}
            />
            <Appbar.Action
              icon="close-circle-outline"
              accessibilityLabel="Cancelar venda"
              onPress={() => {
                setConfirming(true);
              }}
            />
          </>
        ) : null}
      </BackHeader>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.fim }]}
      >
        <Text variant="bodyLarge" style={[styles.who, muted]}>
          {sale.customer ? sale.customer.name : 'Venda avulsa'}
        </Text>
        <Text
          variant="displaySmall"
          accessibilityRole="header"
          accessibilityLabel={`${formatCents(sale.totalCents)}${active ? '' : ', venda cancelada'}`}
          style={[
            styles.total,
            active
              ? { color: theme.colors.primary }
              : { color: theme.colors.onSurfaceVariant, textDecorationLine: 'line-through' },
          ]}
        >
          {formatCents(sale.totalCents)}
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
              Venda cancelada
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onErrorContainer }}>
              {sale.cancelledAt
                ? `Em ${whenFormat.format(new Date(sale.cancelledAt))}${
                    sale.cancelledBy ? `, por ${who(sale.cancelledBy)}` : ''
                  }. `
                : ''}
              Continua no histórico, mas não conta no saldo devedor nem nos pontos.
            </Text>
          </View>
        ) : null}

        <View style={cardStyle}>
          {sale.items.map((item, index) => (
            <View key={`${item.productId}-${String(index)}`}>
              {index > 0 ? divider : null}
              <List.Item
                title={`${String(item.quantity)}× ${item.productName}`}
                description={`${formatCents(item.unitPriceCents)} cada`}
                right={() => (
                  <Text variant="titleMedium" style={styles.itemTotal}>
                    {formatCents(item.totalCents)}
                  </Text>
                )}
                titleStyle={styles.itemTitle}
                descriptionStyle={muted}
              />
            </View>
          ))}
        </View>

        <Text variant="titleMedium" accessibilityRole="header" style={styles.sectionTitle}>
          Pagamento
        </Text>
        <View style={cardStyle}>
          {onAccount && sale.customer ? (
            <List.Item
              title={
                sale.paymentType === 'fiado' ? 'Fiado · na conta do cliente' : 'Na conta do cliente'
              }
              description={`Entra no saldo devedor de ${sale.customer.name}. Toque para ver o saldo.`}
              left={(props) => <List.Icon {...props} icon="notebook-outline" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => {
                if (sale.customer) {
                  router.push({ pathname: '/clientes/[id]', params: { id: sale.customer.id } });
                }
              }}
              titleStyle={styles.itemTitle}
              descriptionStyle={muted}
              descriptionNumberOfLines={2}
            />
          ) : null}
          {!onAccount && sale.payments.length === 0 ? (
            <List.Item
              title="Fiado"
              description="Sem pagamento ligado a esta venda."
              left={(props) => <List.Icon {...props} icon="notebook-outline" />}
              titleStyle={styles.itemTitle}
              descriptionStyle={muted}
            />
          ) : null}
          {sale.payments.map((payment, index) => {
            const cancelled = payment.status === 'cancelled';
            return (
              <View key={payment.id}>
                {index > 0 || onAccount ? divider : null}
                <List.Item
                  title={`Pago na hora · ${methodLabel[payment.method]}${cancelled ? ' · cancelado' : ''}`}
                  description={`${formatCents(payment.amountCents)} · registrado por ${who(payment.recordedBy)}`}
                  left={(props) => (
                    <List.Icon {...props} icon={payment.method === 'pix' ? 'qrcode' : 'cash'} />
                  )}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => {
                    router.push({ pathname: '/pagamentos/[id]', params: { id: payment.id } });
                  }}
                  accessibilityHint="Abre o pagamento"
                  titleStyle={[styles.itemTitle, cancelled ? muted : null]}
                  descriptionStyle={[muted, cancelled ? styles.struck : null]}
                  descriptionNumberOfLines={2}
                />
              </View>
            );
          })}
        </View>

        <Text variant="titleMedium" accessibilityRole="header" style={styles.sectionTitle}>
          Registro
        </Text>
        <View style={cardStyle}>
          <List.Item
            title="Registrada por"
            description={capitalize(who(sale.recordedBy))}
            left={(props) => <List.Icon {...props} icon="account-outline" />}
            titleStyle={styles.labelTitle}
            descriptionStyle={[styles.value, { color: theme.colors.onSurface }]}
          />
          {divider}
          <List.Item
            title="Quando"
            description={whenFormat.format(new Date(sale.createdAt))}
            left={(props) => <List.Icon {...props} icon="clock-outline" />}
            titleStyle={styles.labelTitle}
            descriptionStyle={[styles.value, { color: theme.colors.onSurface }]}
          />
          {sale.editedAt ? (
            <>
              {divider}
              <List.Item
                title="Última correção"
                description={`${whenFormat.format(new Date(sale.editedAt))}${
                  sale.editedBy ? ` · ${who(sale.editedBy)}` : ''
                }`}
                left={(props) => <List.Icon {...props} icon="pencil-outline" />}
                titleStyle={styles.labelTitle}
                descriptionStyle={[styles.value, { color: theme.colors.onSurface }]}
              />
            </>
          ) : null}
        </View>

        {just ? (
          <PrimaryButton
            icon="plus"
            style={styles.again}
            onPress={() => {
              router.replace('/venda');
            }}
          >
            Nova venda
          </PrimaryButton>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={confirming}
        title="Cancelar esta venda?"
        message={
          sale.customer
            ? `A venda de ${formatCents(sale.totalCents)} sai do saldo de ${sale.customer.name}, o pagamento feito na hora é cancelado junto e os pontos dela são estornados. Ela continua no histórico como cancelada.`
            : `A venda de ${formatCents(sale.totalCents)} e o pagamento dela são cancelados. Eles continuam no histórico como cancelados.`
        }
        confirmLabel="Cancelar venda"
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
  sectionTitle: { marginTop: spacing.secao - spacing.gap },
  itemTitle: { fontSize: 17, fontWeight: '700' },
  itemTotal: { alignSelf: 'center', fontWeight: '800' },
  labelTitle: { fontSize: 14, fontWeight: '700' },
  value: { fontSize: 17, marginTop: 2 },
  struck: { textDecorationLine: 'line-through' },
  again: { marginTop: spacing.secao },
});
