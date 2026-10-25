import { formatCents, type MemberRef, type PaymentMethod } from '@cvd/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Divider, List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../../src/core';
import { useSession } from '../../src/session/SessionProvider';
import { radii, spacing } from '../../src/theme/theme';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { BackHeader } from '../../src/ui/BackHeader';
import { LoadingState } from '../../src/ui/LoadingState';
import { PrimaryButton } from '../../src/ui/PrimaryButton';
import { useFocusQuery } from '../../src/ui/useFocusQuery';

const whenFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const methodLabel: Record<PaymentMethod, string> = { pix: 'Pix', cash: 'Dinheiro' };

/** Detalhe da venda: itens, pagamento, quem registrou e quando. */
export default function SaleDetailScreen() {
  const { id, nova } = useLocalSearchParams<{ id: string; nova?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const load = useCallback(() => core.sales.getSale(id), [id]);
  const query = useFocusQuery(load);

  if (!query.data) return <LoadingState query={query} />;
  const sale = query.data;
  const myId = session.state.status === 'ready' ? session.state.member.id : null;
  const who = (member: MemberRef) =>
    member.id === myId ? 'você' : (member.email ?? 'um membro que saiu da loja');
  const just = nova === '1';
  const muted = { color: theme.colors.onSurfaceVariant };
  const divider = <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />;
  const cardStyle = [
    styles.card,
    { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <BackHeader title={just ? 'Venda registrada' : 'Venda'} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.fim }]}
      >
        <Text variant="bodyLarge" style={[styles.who, muted]}>
          {sale.customer ? sale.customer.name : 'Venda avulsa'}
          {sale.status === 'cancelled' ? ' · cancelada' : ''}
        </Text>
        <Text
          variant="displaySmall"
          accessibilityRole="header"
          style={[styles.total, { color: theme.colors.primary }]}
        >
          {formatCents(sale.totalCents)}
        </Text>

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
          {sale.payments.map((payment, index) => (
            <View key={payment.id}>
              {index > 0 ? divider : null}
              <List.Item
                title={`Pago na hora · ${methodLabel[payment.method]}${
                  payment.status === 'cancelled' ? ' · cancelado' : ''
                }`}
                description={`${formatCents(payment.amountCents)} · registrado por ${who(payment.recordedBy)}`}
                left={(props) => (
                  <List.Icon {...props} icon={payment.method === 'pix' ? 'qrcode' : 'cash'} />
                )}
                titleStyle={styles.itemTitle}
                descriptionStyle={muted}
                descriptionNumberOfLines={2}
              />
            </View>
          ))}
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
  again: { marginTop: spacing.secao },
});
