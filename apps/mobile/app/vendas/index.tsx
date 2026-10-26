import { formatCents, type SaleListItem } from '@cvd/core';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../../src/core';
import { dayFormat, methodLabel } from '../../src/payments/debt';
import { radii, spacing } from '../../src/theme/theme';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { LoadingState } from '../../src/ui/LoadingState';
import { BackHeader } from '../../src/ui/BackHeader';
import { useFocusQuery } from '../../src/ui/useFocusQuery';

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const hourFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const shortDay = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

function dayTitle(date: Date, today: Date): string {
  const diff = Math.round((startOfDay(today).getTime() - startOfDay(date).getTime()) / DAY_MS);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return shortDay.format(date);
}

function standingText(sale: SaleListItem): string {
  const { standing } = sale;
  if (standing.type === 'paidNow') return methodLabel[standing.method];
  return { open: 'Fiado em aberto', partial: 'Fiado parcial', paid: 'Fiado quitado' }[
    standing.status
  ];
}

interface Day {
  key: string;
  title: string;
  totalCents: number;
  sales: SaleListItem[];
}

function groupByDay(sales: SaleListItem[], today: Date): Day[] {
  const days: Day[] = [];
  for (const sale of sales) {
    const date = new Date(sale.createdAt);
    const key = dayFormat.format(date);
    let day = days.find((d) => d.key === key);
    if (!day) {
      day = { key, title: dayTitle(date, today), totalCents: 0, sales: [] };
      days.push(day);
    }
    day.totalCents += sale.totalCents;
    day.sales.push(sale);
  }
  return days;
}

/** Todas as vendas feitas, agrupadas por dia (últimos 30 dias, com "Ver mais antigas"). */
export default function SalesListScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [windows, setWindows] = useState(1);
  const load = useCallback(() => {
    const from = startOfDay(new Date(Date.now() - WINDOW_DAYS * windows * DAY_MS));
    return core.sales.listSales({ from: from.toISOString() });
  }, [windows]);
  const query = useFocusQuery(load);

  if (query.status !== 'ready') return <LoadingState query={query} />;

  const days = groupByDay(query.data, new Date());

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <BackHeader />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.fim }]}
      >
        <Text
          variant="headlineLarge"
          accessibilityRole="header"
          style={{ color: theme.colors.primary }}
        >
          Vendas
        </Text>

        {days.length === 0 ? (
          <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
            Nenhuma venda neste período.
          </Text>
        ) : null}

        {days.map((day) => (
          <View key={day.key} style={styles.day}>
            <View style={styles.dayHeader}>
              <Text variant="titleMedium" accessibilityRole="header" style={styles.dayTitle}>
                {day.title}
              </Text>
              <Text variant="titleMedium" style={styles.dayTitle}>
                {formatCents(day.totalCents)}
              </Text>
            </View>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.elevation.level1,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
            >
              {day.sales.map((sale, index) => (
                <View key={sale.id}>
                  {index > 0 ? (
                    <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
                  ) : null}
                  <List.Item
                    title={`${hourFormat.format(new Date(sale.createdAt))} · ${
                      sale.customerName ?? 'Venda avulsa'
                    }`}
                    description={`${sale.summary}\n${standingText(sale)}`}
                    descriptionNumberOfLines={3}
                    onPress={() => {
                      router.push(`/vendas/${sale.id}`);
                    }}
                    right={() => (
                      <Text variant="titleMedium" style={styles.amount}>
                        {formatCents(sale.totalCents)}
                      </Text>
                    )}
                    titleStyle={styles.rowTitle}
                    descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                    style={styles.row}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        <Button
          mode="text"
          style={styles.older}
          onPress={() => {
            setWindows((n) => n + 1);
          }}
        >
          Ver mais antigas
        </Button>
      </ScrollView>
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
  day: { marginTop: spacing.secao },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dayTitle: { fontWeight: '800' },
  card: { borderRadius: radii.cartao, borderWidth: 1.5, overflow: 'hidden' },
  row: { minHeight: 64 },
  rowTitle: { fontSize: 16, fontWeight: '800' },
  amount: { alignSelf: 'center', fontWeight: '800' },
  older: { marginTop: spacing.secao },
});
