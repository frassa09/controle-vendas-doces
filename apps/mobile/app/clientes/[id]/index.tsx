import {
  formatCents,
  formatWhatsApp,
  isCoreError,
  type CustomerBalance,
  type CustomerHistoryEntry,
  type CustomerPoints,
  type PointsMovementKind,
} from '@cvd/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Divider, List, Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../../../src/core';
import { dayFormat, debtSinceText, methodLabel } from '../../../src/payments/debt';
import { radii, spacing } from '../../../src/theme/theme';
import { useAppTheme } from '../../../src/theme/ThemeProvider';
import { BackHeader } from '../../../src/ui/BackHeader';
import { LoadingState } from '../../../src/ui/LoadingState';
import { PrimaryButton } from '../../../src/ui/PrimaryButton';
import { useFocusQuery } from '../../../src/ui/useFocusQuery';

/** Perfil do cliente: saldo devedor, pontos, histórico, contato, PIN e consentimento. */
export default function CustomerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const load = useCallback(
    () =>
      Promise.all([
        core.customers.getCustomer(id),
        core.payments.getCustomerBalance(id),
        core.points.getCustomerPoints(id),
        core.sales.listCustomerHistory(id),
      ]),
    [id],
  );
  const query = useFocusQuery(load);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Manda o link da página e o PIN pelo WhatsApp do cliente.
  const resendAccess = async () => {
    if (sending) return;
    setSending(true);
    try {
      const message = await core.receipts.buildAccessMessage(id);
      await Linking.openURL(message.whatsappUrl);
    } catch (error) {
      setNotice(isCoreError(error) ? error.message : 'Não deu para abrir o WhatsApp.');
    } finally {
      setSending(false);
    }
  };

  if (!query.data) return <LoadingState query={query} />;
  const [customer, balance, points, history] = query.data;
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
        <PointsCard points={points} />
        <HistoryCard history={history} />

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
          <Button
            mode="outlined"
            icon="whatsapp"
            style={styles.resend}
            contentStyle={styles.resendContent}
            loading={sending}
            disabled={sending}
            onPress={() => void resendAccess()}
          >
            Reenviar link e PIN
          </Button>
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

      <Snackbar
        visible={notice !== null}
        onDismiss={() => {
          setNotice(null);
        }}
        duration={5000}
        style={{ backgroundColor: theme.colors.inverseSurface, marginBottom: insets.bottom }}
      >
        {notice ?? ''}
      </Snackbar>
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

const kindLabel: Record<PointsMovementKind, string> = {
  saleCredit: 'Compra paga',
  saleReversal: 'Estorno de compra',
  saleAdjustment: 'Ajuste de compra',
  redemption: 'Resgate',
};

/** Saldo de pontos (pode ser negativo depois de um estorno) e o extrato, do mais novo ao mais antigo. */
function PointsCard({ points }: { points: CustomerPoints }) {
  const router = useRouter();
  const theme = useAppTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  const unit = (n: number) => `${String(n)} ${Math.abs(n) === 1 ? 'ponto' : 'pontos'}`;

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
          Pontos
        </Text>
        <Text
          variant="displaySmall"
          accessibilityLabel={`Saldo de ${unit(points.balance)}`}
          style={[styles.debtValue, { color: theme.colors.onSurface }]}
        >
          {points.balance}
        </Text>
        {points.movements.length === 0 ? (
          <Text variant="bodyMedium" style={[styles.debtSince, muted]}>
            Os pontos entram quando a compra é paga por inteiro.
          </Text>
        ) : null}
      </View>

      {points.movements.map((movement) => (
        <View key={movement.id}>
          <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
          <List.Item
            title={kindLabel[movement.kind]}
            description={dayFormat.format(new Date(movement.createdAt))}
            right={() => (
              <Text
                variant="titleMedium"
                style={[
                  styles.openValue,
                  {
                    color:
                      movement.points > 0 ? theme.colors.primary : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                {movement.points > 0 ? '+' : ''}
                {movement.points}
              </Text>
            )}
            onPress={
              movement.saleId === null
                ? undefined
                : () => {
                    router.push({
                      pathname: '/vendas/[id]',
                      params: { id: movement.saleId ?? '' },
                    });
                  }
            }
            accessibilityLabel={`${kindLabel[movement.kind]} em ${dayFormat.format(new Date(movement.createdAt))}, ${movement.points > 0 ? 'mais' : 'menos'} ${unit(Math.abs(movement.points))}`}
            titleStyle={styles.itemTitle}
            descriptionStyle={muted}
          />
        </View>
      ))}
    </View>
  );
}

/** Compras e pagamentos de dívida, do mais novo ao mais antigo; cancelados aparecem riscados. */
function HistoryCard({ history }: { history: CustomerHistoryEntry[] }) {
  const router = useRouter();
  const theme = useAppTheme();
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
        <Text variant="labelLarge" style={muted} accessibilityRole="header">
          Histórico
        </Text>
        {history.length === 0 ? (
          <Text variant="bodyMedium" style={[styles.debtSince, muted]}>
            Nenhuma compra ainda.
          </Text>
        ) : null}
      </View>

      {history.map((entry) => {
        const cancelled = entry.status === 'cancelled';
        const day = dayFormat.format(new Date(entry.createdAt));
        let title: string;
        let detail: string;
        let cents: number;
        if (entry.type === 'sale') {
          title = `Compra de ${day}${cancelled ? ' · cancelada' : ''}`;
          detail = `${entry.units === 1 ? '1 item' : `${String(entry.units)} itens`} · ${
            entry.paymentType === 'fiado' ? 'fiado' : 'paga na hora'
          }`;
          cents = entry.totalCents;
        } else {
          title = `Pagamento de ${day}${cancelled ? ' · cancelado' : ''}`;
          detail = methodLabel[entry.method];
          cents = entry.amountCents;
        }
        const valueColor = cancelled
          ? theme.colors.onSurfaceVariant
          : entry.type === 'payment'
            ? theme.colors.primary
            : theme.colors.onSurface;
        return (
          <View key={`${entry.type}-${entry.id}`}>
            <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
            <List.Item
              title={title}
              description={detail}
              left={(props) => (
                <List.Icon
                  {...props}
                  icon={entry.type === 'sale' ? 'basket-outline' : 'cash-check'}
                />
              )}
              right={() => (
                <Text
                  variant="titleMedium"
                  style={[
                    styles.openValue,
                    { color: valueColor },
                    cancelled ? styles.struck : null,
                  ]}
                >
                  {formatCents(cents)}
                </Text>
              )}
              onPress={() => {
                if (entry.type === 'sale') {
                  router.push({ pathname: '/vendas/[id]', params: { id: entry.id } });
                } else {
                  router.push({ pathname: '/pagamentos/[id]', params: { id: entry.id } });
                }
              }}
              titleStyle={[styles.itemTitle, cancelled ? muted : null]}
              descriptionStyle={muted}
            />
          </View>
        );
      })}
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
  resend: {
    marginHorizontal: spacing.margem,
    marginBottom: spacing.gap,
    borderRadius: radii.botao,
  },
  resendContent: { minHeight: 48 },
  struck: { textDecorationLine: 'line-through' },
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
