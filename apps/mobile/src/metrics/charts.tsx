import { formatCents } from '@cvd/core';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { materials } from '../theme/storeColors';
import { useAppTheme } from '../theme/ThemeProvider';

/**
 * Gráficos do painel de métricas, só com Views (sem biblioteca). Seguem o dataviz do
 * projeto: marcas finas com a ponta de dados arredondada (4dp) e ancorada na base,
 * uma cor por série (loja-forte; madeira escura como segunda), grade quase invisível,
 * valores no texto cacau (nunca na cor da série) e legenda sempre que há 2 séries.
 * Cada gráfico traz o valor por escrito (linha da lista ou leitura ao tocar), então a
 * leitura nunca depende só da cor.
 */

export const SECOND_SERIES = materials.madeira2;

export interface BarRow {
  key: string;
  label: string;
  /** Valor que dá o comprimento da barra. */
  value: number;
  /** Texto do valor, à direita. */
  valueText: string;
  /** Linha de apoio abaixo do rótulo (opcional). */
  hint?: string;
}

/** Barras horizontais com rótulo e valor por escrito: ranking de produtos, dia da semana. */
export function BarList({ rows, color }: { rows: BarRow[]; color?: string }) {
  const theme = useAppTheme();
  const fill = color ?? theme.colors.primary;
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View
          key={row.key}
          accessible
          accessibilityLabel={`${row.label}: ${row.valueText}${row.hint ? `, ${row.hint}` : ''}`}
          style={styles.barRow}
        >
          <View style={styles.barHead}>
            <Text variant="bodyMedium" numberOfLines={1} style={styles.barLabel}>
              {row.label}
            </Text>
            <Text variant="bodyMedium" style={styles.barValue}>
              {row.valueText}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
            {row.value > 0 ? (
              <View
                style={[
                  styles.fill,
                  { backgroundColor: fill, width: `${String((row.value / max) * 100)}%` },
                ]}
              />
            ) : null}
          </View>
          {row.hint ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {row.hint}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export interface ColumnItem {
  key: string;
  /** Rótulo no eixo (só aparece onde `showLabel`). */
  label: string;
  showLabel: boolean;
  value: number;
  /** Leitura completa ao tocar na coluna. */
  reading: string;
}

const CHART_HEIGHT = 120;

/** Colunas finas (ex.: vendas por hora); tocar numa coluna mostra o valor dela. */
export function ColumnChart({ items, emptyText }: { items: ColumnItem[]; emptyText: string }) {
  const theme = useAppTheme();
  const [picked, setPicked] = useState<string | null>(null);
  const max = Math.max(0, ...items.map((i) => i.value));
  const current = items.find((i) => i.key === picked);

  if (max === 0) {
    return (
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {emptyText}
      </Text>
    );
  }

  return (
    <View>
      <Text
        variant="bodyMedium"
        accessibilityLiveRegion="polite"
        style={[styles.reading, { color: theme.colors.onSurface }]}
      >
        {current ? current.reading : 'Toque numa coluna para ver o valor.'}
      </Text>
      <View style={[styles.columns, { borderBottomColor: theme.colors.outlineVariant }]}>
        {items.map((item) => {
          const height = item.value === 0 ? 0 : Math.max(3, (item.value / max) * CHART_HEIGHT);
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.reading}
              onPress={() => {
                setPicked(item.key);
              }}
              style={styles.columnHit}
            >
              <View
                style={[
                  styles.column,
                  {
                    height,
                    backgroundColor: theme.colors.primary,
                    opacity: picked === null || picked === item.key ? 1 : 0.45,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {items.map((item) => (
          <View key={item.key} style={styles.axisCell}>
            {item.showLabel ? (
              <Text variant="labelSmall" style={styles.axisText} numberOfLines={1}>
                {item.label}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  valueText: string;
  color: string;
}

/** Uma barra dividida em partes (ex.: Pix × dinheiro), com legenda e valores por escrito. */
export function SplitBar({ segments }: { segments: Segment[] }) {
  const theme = useAppTheme();
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <View>
      <View
        style={[styles.split, { backgroundColor: theme.colors.surfaceVariant }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {total > 0
          ? segments
              .filter((s) => s.value > 0)
              .map((s) => (
                <View
                  key={s.key}
                  style={[styles.splitPart, { flex: s.value, backgroundColor: s.color }]}
                />
              ))
          : null}
      </View>
      <View style={styles.legend}>
        {segments.map((s) => (
          <View
            key={s.key}
            accessible
            accessibilityLabel={`${s.label}: ${s.valueText}`}
            style={styles.legendItem}
          >
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text variant="bodyMedium" style={[styles.barLabel, styles.legendLabel]}>
              {s.label}
            </Text>
            <Text variant="bodyMedium" style={styles.barValue}>
              {s.valueText}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** "R$ 12,00" curto para o valor das barras. */
export const moneyText = (cents: number) => formatCents(cents);

const styles = StyleSheet.create({
  list: { gap: 14 },
  barRow: { gap: 4 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  barLabel: { flexShrink: 1, fontWeight: '700' },
  barValue: { fontWeight: '800' },
  track: { height: 10, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' },
  fill: { height: 10, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  reading: { minHeight: 22, marginBottom: 8, fontWeight: '700' },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    borderBottomWidth: 1,
  },
  columnHit: { flex: 1, height: CHART_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
  column: { width: 6, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', marginTop: 4 },
  axisCell: { flex: 1, alignItems: 'center' },
  axisText: { width: 40, textAlign: 'center', color: materials.cacau2 },
  split: { height: 14, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', gap: 2 },
  splitPart: { height: 14 },
  legend: { marginTop: 12, gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendLabel: { flex: 1 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
});
