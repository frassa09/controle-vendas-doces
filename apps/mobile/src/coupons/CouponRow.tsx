import { isCoreError, type Coupon } from '@cvd/core';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { core } from '../core';
import { dayFormat } from '../payments/debt';
import { radii, spacing } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeProvider';

const originLabel: Record<Coupon['origin'], string> = {
  redemption: 'Troca de pontos',
  scratch: 'Raspadinha',
};

/** "Troca de pontos · 25/10/2026". */
export function couponOriginText(coupon: Coupon): string {
  return `${originLabel[coupon.origin]} · ${dayFormat.format(new Date(coupon.createdAt))}`;
}

/** "Brownie entregue para Júlia." */
export function deliveredText(coupon: Coupon): string {
  return `${coupon.productName} entregue para ${coupon.customer.name}.`;
}

function messageOf(error: unknown): string {
  return isCoreError(error) ? error.message : 'Não deu para dar baixa. Tente de novo.';
}

interface CouponRowProps {
  coupon: Coupon;
  /** Mostra o nome do cliente (lista da loja); na venda o cliente já está na tela. */
  showCustomer?: boolean;
  onDelivered: (coupon: Coupon) => void;
  onError: (message: string) => void;
}

/** Um prêmio pendente com o botão de entrega (um toque dá baixa). */
export function CouponRow({ coupon, showCustomer = false, onDelivered, onError }: CouponRowProps) {
  const theme = useAppTheme();
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const deliver = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      onDelivered(await core.coupons.deliverCoupon(coupon.id));
    } catch (error) {
      onError(messageOf(error));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: theme.colors.primaryContainer }]}>
        <Icon source="gift-outline" size={22} color={theme.colors.onPrimaryContainer} />
      </View>
      <View style={styles.text}>
        <Text variant="titleMedium" style={styles.product}>
          {coupon.productName}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {showCustomer ? `${coupon.customer.name} · ` : ''}
          {couponOriginText(coupon)}
        </Text>
      </View>
      <Button
        mode="contained-tonal"
        loading={busy}
        disabled={busy}
        onPress={() => void deliver()}
        accessibilityLabel={`Entregar ${coupon.productName} para ${coupon.customer.name}`}
        style={styles.button}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Entregar
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.margem,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  product: { fontWeight: '800' },
  button: { borderRadius: radii.botao },
  buttonContent: { minHeight: 48 },
  buttonLabel: { fontSize: 16, fontWeight: '800' },
});
