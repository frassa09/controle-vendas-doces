import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Divider, Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CouponRow, deliveredText } from '../src/coupons/CouponRow';
import { core } from '../src/core';
import { radii, spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { BackHeader } from '../src/ui/BackHeader';
import { LoadingState } from '../src/ui/LoadingState';
import { useFocusQuery } from '../src/ui/useFocusQuery';

/** Todos os prêmios ainda não entregues da loja, do mais antigo para o mais novo. */
export default function CouponsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const query = useFocusQuery(useCallback(() => core.coupons.listPendingCoupons(), []));
  const [notice, setNotice] = useState<string | null>(null);

  if (!query.data) return <LoadingState query={query} />;
  const coupons = query.data;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <BackHeader title="Cupons" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.fim }]}
      >
        <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
          {coupons.length === 0
            ? 'Nenhum prêmio para entregar. Quando um cliente trocar pontos na página dele, o cupom aparece aqui e na hora da venda.'
            : `${coupons.length === 1 ? '1 prêmio espera' : `${String(coupons.length)} prêmios esperam`} entrega. Toque em Entregar quando o cliente levar.`}
        </Text>

        {coupons.length > 0 ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.elevation.level1,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          >
            {coupons.map((coupon, index) => (
              <View key={coupon.id}>
                {index > 0 ? (
                  <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
                ) : null}
                <CouponRow
                  coupon={coupon}
                  showCustomer
                  onDelivered={(delivered) => {
                    setNotice(deliveredText(delivered));
                    void query.reload();
                  }}
                  onError={(message) => {
                    setNotice(message);
                    void query.reload();
                  }}
                />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Snackbar
        visible={notice !== null}
        onDismiss={() => {
          setNotice(null);
        }}
        duration={2600}
        style={{ backgroundColor: theme.colors.inverseSurface, marginBottom: insets.bottom }}
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
    paddingTop: spacing.gap,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  lead: { fontWeight: '600', lineHeight: 25 },
  card: {
    marginTop: spacing.secao,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
});
