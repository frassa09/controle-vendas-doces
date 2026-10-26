import { formatCents, type PeriodMetrics } from '@cvd/core';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../src/core';
import {
  BarList,
  ColumnChart,
  SECOND_SERIES,
  SplitBar,
  type BarRow,
  type ColumnItem,
} from '../src/metrics/charts';
import {
  boundsOf,
  deltaText,
  isCurrentOrFuture,
  labelOf,
  metricsOptionsOf,
  parseDay,
  shiftChoice,
  startOfDay,
  type PeriodChoice,
  type PeriodKind,
} from '../src/metrics/period';
import { dayFormat } from '../src/payments/debt';
import { radii, spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { BackHeader } from '../src/ui/BackHeader';
import { LoadingState } from '../src/ui/LoadingState';
import { useFocusQuery } from '../src/ui/useFocusQuery';

const PRODUCT_ROWS = 8;
// Segunda a domingo (o banco conta 0 = domingo).
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

const countText = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

function Card({ title, children }: { title: string; children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={styles.section}>
      <Text variant="titleMedium" accessibilityRole="header" style={styles.sectionTitle}>
        {title}
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
        {children}
      </View>
    </View>
  );
}

function Figure({
  label,
  value,
  delta,
  big,
}: {
  label: string;
  value: string;
  delta: string | null;
  big?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={styles.figure}
      accessible
      accessibilityLabel={`${label}: ${value}. ${delta ?? ''}`}
    >
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text
        variant={big ? 'headlineMedium' : 'titleLarge'}
        style={big ? { color: theme.colors.primary } : styles.figureValue}
      >
        {value}
      </Text>
      {delta ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {delta}
        </Text>
      ) : null}
    </View>
  );
}

function Muted({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
      {children}
    </Text>
  );
}

function Summary({ now, before }: { now: PeriodMetrics; before: PeriodMetrics }) {
  return (
    <Card title="Resumo">
      <Figure
        big
        label="Faturamento"
        value={formatCents(now.revenueCents)}
        delta={deltaText(now.revenueCents, before.revenueCents)}
      />
      <View style={styles.grid}>
        <Figure
          label="Recebido"
          value={formatCents(now.receivedCents)}
          delta={deltaText(now.receivedCents, before.receivedCents)}
        />
        <Figure
          label="A receber"
          value={formatCents(now.toReceiveCents)}
          delta={deltaText(now.toReceiveCents, before.toReceiveCents)}
        />
        <Figure
          label="Ticket médio"
          value={formatCents(now.averageTicketCents)}
          delta={deltaText(now.averageTicketCents, before.averageTicketCents)}
        />
        <Figure
          label="Vendas"
          value={String(now.salesCount)}
          delta={deltaText(now.salesCount, before.salesCount)}
        />
      </View>
      <Muted>
        Recebido soma os pagamentos do período, inclusive de dívidas antigas. A receber é o que
        ainda falta pagar das vendas do período.
      </Muted>
    </Card>
  );
}

function Rhythm({ now }: { now: PeriodMetrics }) {
  const weekdayRows: BarRow[] = WEEKDAY_ORDER.map((n) => {
    const day = now.byWeekday.find((d) => d.weekday === n);
    return {
      key: String(n),
      label: WEEKDAY_NAMES[n],
      value: day?.revenueCents ?? 0,
      valueText: formatCents(day?.revenueCents ?? 0),
      hint: countText(day?.salesCount ?? 0, 'venda', 'vendas'),
    };
  });
  const hours: ColumnItem[] = now.byHour.map((h) => ({
    key: String(h.hour),
    label: `${String(h.hour)}h`,
    showLabel: h.hour % 6 === 0,
    value: h.revenueCents,
    reading: `${String(h.hour)}h: ${formatCents(h.revenueCents)} em ${countText(h.salesCount, 'venda', 'vendas')}`,
  }));
  const pix = now.byMethod.pix;
  const cash = now.byMethod.cash;
  const theme = useAppTheme();

  return (
    <>
      <Card title="Pix × dinheiro">
        <SplitBar
          segments={[
            {
              key: 'pix',
              label: 'Pix',
              value: pix.cents,
              valueText: `${formatCents(pix.cents)} · ${countText(pix.count, 'pagamento', 'pagamentos')}`,
              color: theme.colors.primary,
            },
            {
              key: 'cash',
              label: 'Dinheiro',
              value: cash.cents,
              valueText: `${formatCents(cash.cents)} · ${countText(cash.count, 'pagamento', 'pagamentos')}`,
              color: SECOND_SERIES,
            },
          ]}
        />
      </Card>
      <Card title="Vendas por dia da semana">
        {now.salesCount === 0 ? (
          <Muted>Sem vendas neste período.</Muted>
        ) : (
          <BarList rows={weekdayRows} />
        )}
      </Card>
      <Card title="Vendas por horário">
        <ColumnChart items={hours} emptyText="Sem vendas neste período." />
      </Card>
    </>
  );
}

function Products({ now }: { now: PeriodMetrics }) {
  const byQuantity = now.products.slice(0, PRODUCT_ROWS);
  const byRevenue = [...now.products]
    .sort((a, b) => b.revenueCents - a.revenueCents || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, PRODUCT_ROWS);
  const sold = now.products.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <>
      <Card title="Mais vendidos">
        {now.products.length === 0 ? (
          <Muted>Sem vendas neste período.</Muted>
        ) : (
          <BarList
            rows={byQuantity.map((p) => ({
              key: p.productId,
              label: p.name,
              value: p.quantity,
              valueText: `${String(p.quantity)} un.`,
              hint: `${formatCents(p.revenueCents)}${p.isCombo ? ' · combo' : ''}`,
            }))}
          />
        )}
      </Card>
      <Card title="Receita por produto">
        {now.products.length === 0 ? (
          <Muted>Sem vendas neste período.</Muted>
        ) : (
          <BarList
            rows={byRevenue.map((p) => ({
              key: p.productId,
              label: p.name,
              value: p.revenueCents,
              valueText: formatCents(p.revenueCents),
            }))}
          />
        )}
      </Card>
      <Card title="Combos e descontos">
        <View style={styles.grid}>
          <Figure
            label="Combos vendidos"
            value={String(now.combos.quantity)}
            delta={formatCents(now.combos.revenueCents)}
          />
          <Figure
            label="Descontos dados"
            value={formatCents(now.discounts.totalCents)}
            delta={
              now.discounts.units === 0
                ? null
                : `${countText(now.discounts.units, 'unidade', 'unidades')} em ${countText(now.discounts.salesCount, 'venda', 'vendas')}`
            }
          />
        </View>
        <Muted>
          {sold === 0
            ? 'Sem vendas neste período.'
            : 'Desconto é a diferença entre o preço atual do produto e o preço cobrado.'}
        </Muted>
      </Card>
    </>
  );
}

function Customers({ now, before }: { now: PeriodMetrics; before: PeriodMetrics }) {
  const theme = useAppTheme();
  const c = now.customers;
  const topRows: BarRow[] = c.top.map((t) => ({
    key: t.customerId,
    label: t.name,
    value: t.totalCents,
    valueText: formatCents(t.totalCents),
    hint: countText(t.salesCount, 'compra', 'compras'),
  }));

  return (
    <>
      <Card title="Melhores clientes">
        {topRows.length === 0 ? (
          <Muted>Nenhuma compra de cliente cadastrado.</Muted>
        ) : (
          <BarList rows={topRows} />
        )}
        {c.walkInSalesCount > 0 ? (
          <Muted>
            {countText(c.walkInSalesCount, 'venda avulsa', 'vendas avulsas')} não entram aqui.
          </Muted>
        ) : null}
      </Card>
      <Card title="Novos e recorrentes">
        <SplitBar
          segments={[
            {
              key: 'new',
              label: 'Novos (primeira compra)',
              value: c.newCount,
              valueText: String(c.newCount),
              color: theme.colors.primary,
            },
            {
              key: 'returning',
              label: 'Recorrentes',
              value: c.returningCount,
              valueText: String(c.returningCount),
              color: SECOND_SERIES,
            },
          ]}
        />
        <Figure
          label="Frequência média"
          value={`${String(c.averageFrequency).replace('.', ',')} compras por cliente`}
          delta={
            before.customers.buyersCount === 0
              ? null
              : `antes: ${String(before.customers.averageFrequency).replace('.', ',')}`
          }
        />
      </Card>
      <Card title="Clientes sumidos">
        <Muted>
          {c.lapsedCount === 0
            ? 'Ninguém sumiu: todos compraram nos últimos 30 dias.'
            : `${countText(c.lapsedCount, 'cliente está', 'clientes estão')} há mais de 30 dias sem comprar.`}
        </Muted>
        {c.lapsed.map((l) => (
          <View
            key={l.customerId}
            accessible
            accessibilityLabel={`${l.name}, última compra em ${dayFormat.format(new Date(l.lastPurchaseAt))}, já gastou ${formatCents(l.totalCents)}`}
            style={styles.lapsedRow}
          >
            <Text variant="bodyLarge" style={styles.barName}>
              {l.name}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              última compra em {dayFormat.format(new Date(l.lastPurchaseAt))} · já gastou{' '}
              {formatCents(l.totalCents)}
            </Text>
          </View>
        ))}
      </Card>
    </>
  );
}

const KIND_BUTTONS: { value: PeriodKind; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'range', label: 'Intervalo' },
];

/** Página de métricas: separada das telas de operação, com filtro de período. */
export default function MetricsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState<PeriodChoice>(() => ({
    kind: 'week',
    anchor: startOfDay(new Date()),
  }));
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const now = new Date();

  const load = useCallback(() => core.metrics.getMetrics(metricsOptionsOf(choice)), [choice]);
  const query = useFocusQuery(load);

  const pickKind = (kind: PeriodKind) => {
    const today = startOfDay(new Date());
    setRangeError(null);
    if (kind === 'range') {
      const { from, to } = boundsOf(choice);
      const last = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1);
      setFromText(dayFormat.format(from));
      setToText(dayFormat.format(last));
      setChoice({ kind, anchor: from, end: last });
    } else {
      setChoice({ kind, anchor: kind === 'day' ? today : choice.anchor });
    }
  };

  const applyRange = () => {
    const from = parseDay(fromText, new Date());
    const to = parseDay(toText, new Date());
    if (!from || !to) {
      setRangeError('Use o formato dia/mês/ano, por exemplo 05/03/2026.');
      return;
    }
    if (to < from) {
      setRangeError('A data final precisa ser depois da inicial.');
      return;
    }
    setRangeError(null);
    setChoice({ kind: 'range', anchor: from, end: to });
  };

  const data = query.data;
  if (!data) return <LoadingState query={query} />;

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
          Métricas
        </Text>

        <SegmentedButtons
          style={styles.kinds}
          value={choice.kind}
          onValueChange={(value) => {
            pickKind(value);
          }}
          buttons={KIND_BUTTONS.map((b) => ({ ...b, showSelectedCheck: false }))}
        />

        {choice.kind === 'range' ? (
          <View style={styles.range}>
            <View style={styles.rangeFields}>
              <TextInput
                mode="outlined"
                label="De"
                value={fromText}
                onChangeText={setFromText}
                placeholder="dd/mm/aaaa"
                keyboardType="numbers-and-punctuation"
                style={styles.rangeField}
              />
              <TextInput
                mode="outlined"
                label="Até"
                value={toText}
                onChangeText={setToText}
                placeholder="dd/mm/aaaa"
                keyboardType="numbers-and-punctuation"
                style={styles.rangeField}
              />
            </View>
            {rangeError ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
                {rangeError}
              </Text>
            ) : null}
            <Button mode="contained-tonal" onPress={applyRange}>
              Ver este intervalo
            </Button>
          </View>
        ) : (
          <View style={styles.navigator}>
            <IconButton
              icon="chevron-left"
              accessibilityLabel="Período anterior"
              onPress={() => {
                setChoice(shiftChoice(choice, -1));
              }}
            />
            <Text variant="titleMedium" style={styles.periodLabel}>
              {labelOf(choice, now)}
            </Text>
            <IconButton
              icon="chevron-right"
              accessibilityLabel="Próximo período"
              disabled={isCurrentOrFuture(choice, now)}
              onPress={() => {
                setChoice(shiftChoice(choice, 1));
              }}
            />
          </View>
        )}
        {choice.kind === 'range' ? null : (
          <Muted>Comparado com {labelOfPrevious(choice, now)}.</Muted>
        )}

        {query.status === 'error' ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.error, marginTop: spacing.gap }}>
            Não deu para atualizar. Mostrando os últimos dados carregados.
          </Text>
        ) : null}

        <Summary now={data.period} before={data.previous} />
        <Rhythm now={data.period} />
        <Products now={data.period} />
        <Customers now={data.period} before={data.previous} />
      </ScrollView>
    </View>
  );
}

function labelOfPrevious(choice: PeriodChoice, now: Date): string {
  return labelOf(shiftChoice(choice, -1), now).toLowerCase();
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
  kinds: { marginTop: spacing.margem },
  navigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  periodLabel: { flex: 1, textAlign: 'center', fontWeight: '800' },
  range: { marginTop: spacing.gap, gap: spacing.gap },
  rangeFields: { flexDirection: 'row', gap: spacing.gap },
  rangeField: { flex: 1 },
  section: { marginTop: spacing.secao },
  sectionTitle: { fontWeight: '800', marginBottom: 8 },
  card: {
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    padding: spacing.margem,
    gap: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: spacing.margem },
  figure: { gap: 2, minWidth: '45%', flexGrow: 1 },
  figureValue: { fontWeight: '800' },
  lapsedRow: { gap: 2 },
  barName: { fontWeight: '700' },
});
