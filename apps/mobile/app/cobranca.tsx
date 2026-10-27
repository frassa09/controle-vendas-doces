import {
  formatCents,
  isCoreError,
  type CollectionQueueItem,
  type CollectionRange,
} from '@cvd/core';
import { useCallback, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Divider, Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../src/core';
import { ageText, dayFormat } from '../src/payments/debt';
import { radii, spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { BackHeader } from '../src/ui/BackHeader';
import { useFocusQuery } from '../src/ui/useFocusQuery';

const ranges: { value: CollectionRange; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'upTo7', label: 'Até 7 dias' },
  { value: 'upTo30', label: '8 a 30 dias' },
  { value: 'over30', label: 'Mais de 30' },
];

const failMessage = (error: unknown) =>
  isCoreError(error) ? error.message : 'Algo deu errado. Tente de novo.';

/** A fila de cobrança: quem deve, da dívida mais antiga para a mais nova. */
export default function CollectionQueueScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<CollectionRange>('all');
  const load = useCallback(() => core.collections.getQueue({ range }), [range]);
  // Recarrega ao ganhar foco: ao voltar do WhatsApp a "última cobrança" já aparece.
  const query = useFocusQuery(load);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    await query.reload();
    setRefreshing(false);
  };

  const charge = async (item: CollectionQueueItem) => {
    if (sending) return;
    setSending(item.customerId);
    try {
      const message = await core.collections.buildMessage(item.customerId);
      // Não há como saber se a mensagem foi mesmo enviada: registra ao abrir o WhatsApp.
      await core.collections.recordSent(item.customerId);
      try {
        await Linking.openURL(message.whatsappUrl);
      } catch {
        setNotice('Não deu para abrir o WhatsApp. A cobrança ficou registrada.');
      }
      await query.reload();
    } catch (error) {
      setNotice(failMessage(error));
    } finally {
      setSending(null);
    }
  };

  const items = query.data ?? [];
  const total = items.reduce((sum, item) => sum + item.balanceCents, 0);

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <BackHeader />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.fim }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text
          variant="headlineLarge"
          accessibilityRole="header"
          style={{ color: theme.colors.primary }}
        >
          Cobrança
        </Text>
        <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
          Quem está devendo, da dívida mais antiga para a mais nova. Um toque abre o WhatsApp com a
          mensagem pronta.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          accessibilityRole="radiogroup"
        >
          {ranges.map((option) => (
            <Chip
              key={option.value}
              selected={range === option.value}
              showSelectedCheck={false}
              accessibilityRole="radio"
              accessibilityState={{ selected: range === option.value }}
              onPress={() => {
                setRange(option.value);
              }}
              style={[
                styles.chip,
                range === option.value && { backgroundColor: theme.colors.primaryContainer },
              ]}
              textStyle={styles.chipText}
            >
              {option.label}
            </Chip>
          ))}
        </ScrollView>

        {query.status === 'loading' ? (
          <ActivityIndicator style={styles.state} accessibilityLabel="Carregando a fila" />
        ) : null}

        {query.status === 'error' && items.length === 0 ? (
          <View style={styles.state}>
            <Text variant="bodyLarge" style={styles.stateText}>
              {failMessage(query.error)}
            </Text>
            <Button mode="outlined" onPress={refresh} style={styles.retry}>
              Tentar de novo
            </Button>
          </View>
        ) : null}

        {query.status === 'ready' && items.length === 0 ? (
          <View style={styles.state}>
            <Text variant="titleMedium" style={styles.stateText}>
              {range === 'all' ? 'Ninguém está devendo.' : 'Ninguém nessa faixa.'}
            </Text>
            <Text
              variant="bodyLarge"
              style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}
            >
              {range === 'all'
                ? 'Quando uma venda fiado ficar em aberto, o cliente aparece aqui.'
                : 'Toque em outra faixa para ver o resto da fila.'}
            </Text>
          </View>
        ) : null}

        {items.length > 0 ? (
          <>
            <Text variant="titleMedium" style={styles.summary}>
              {items.length === 1 ? '1 cliente' : `${String(items.length)} clientes`} ·{' '}
              {formatCents(total)} a receber
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
              {items.map((item, index) => (
                <View key={item.customerId}>
                  {index > 0 ? (
                    <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
                  ) : null}
                  <QueueRow
                    item={item}
                    busy={sending === item.customerId}
                    disabled={sending !== null}
                    onCharge={charge}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Snackbar
        visible={notice !== null}
        onDismiss={() => {
          setNotice(null);
        }}
        duration={3200}
        style={{ backgroundColor: theme.colors.inverseSurface, marginBottom: insets.bottom }}
      >
        {notice ?? ''}
      </Snackbar>
    </View>
  );
}

function QueueRow({
  item,
  busy,
  disabled,
  onCharge,
}: {
  item: CollectionQueueItem;
  busy: boolean;
  disabled: boolean;
  onCharge: (item: CollectionQueueItem) => Promise<void>;
}) {
  const theme = useAppTheme();
  const last =
    item.lastCollectionAt === null
      ? 'Ainda não cobrado'
      : `Última cobrança em ${dayFormat.format(new Date(item.lastCollectionAt))}`;

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text variant="titleMedium" style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text variant="titleLarge" style={[styles.amount, { color: theme.colors.primary }]}>
          {formatCents(item.balanceCents)}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Em aberto {ageText(item.daysOpen)}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {last}
        </Text>
      </View>
      <Button
        mode="contained"
        icon="whatsapp"
        loading={busy}
        disabled={disabled}
        accessibilityLabel={`Cobrar ${item.name} pelo WhatsApp`}
        onPress={() => void onCharge(item)}
        style={styles.chargeButton}
        contentStyle={styles.chargeContent}
        labelStyle={styles.chargeLabel}
      >
        Cobrar
      </Button>
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
  lead: { marginTop: spacing.gap, fontWeight: '600', lineHeight: 25 },
  filters: { gap: spacing.gap, paddingVertical: spacing.margem },
  chip: { minHeight: 44, justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '700' },
  summary: { marginBottom: spacing.gap, fontWeight: '800' },
  state: { marginTop: spacing.secao, alignItems: 'center', gap: spacing.gap },
  stateText: { textAlign: 'center', fontWeight: '600' },
  retry: { marginTop: spacing.gap },
  card: {
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.margem,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontWeight: '800' },
  amount: { fontWeight: '800' },
  chargeButton: { borderRadius: radii.botao },
  chargeContent: { minHeight: 48 },
  chargeLabel: { fontSize: 16, lineHeight: 22 },
});
