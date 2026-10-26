import { POINTS_VALIDITY_LIMITS, type Store } from '@cvd/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';
import { core } from '../src/core';
import { useSession } from '../src/session/SessionProvider';
import { radii, spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { BackHeader } from '../src/ui/BackHeader';
import { FormError } from '../src/ui/FormError';
import { FormField } from '../src/ui/FormField';
import { FormScreen } from '../src/ui/FormScreen';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { useCoreForm } from '../src/ui/useCoreForm';

/** Validade dos pontos: sem validade, ou quantos dias sem compra paga até vencerem. */
export default function PointsValidityScreen() {
  const session = useSession();
  if (session.state.status !== 'ready') return null;
  return <ValidityForm store={session.state.store} />;
}

function ValidityForm({ store }: { store: Store }) {
  const router = useRouter();
  const theme = useAppTheme();
  const session = useSession();
  const form = useCoreForm<'pointsValidityDays'>();
  const [expires, setExpires] = useState(store.pointsValidityDays !== null);
  const [days, setDays] = useState(
    store.pointsValidityDays === null ? '' : String(store.pointsValidityDays),
  );

  const save = () =>
    form.submit(async () => {
      const value = expires ? (/^\d+$/.test(days.trim()) ? Number(days.trim()) : Number.NaN) : null;
      const saved = await core.store.updatePointsValidity(value);
      session.storeUpdated(saved);
      router.back();
    });

  return (
    <FormScreen header={<BackHeader title="Validade dos pontos" />}>
      <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
        Os pontos do cliente vencem quando ele passa esse tempo sem fazer uma compra paga. Cada
        compra paga dá um prazo novo para todos os pontos. Quando vencem, saem do saldo e ficam
        registrados como &quot;Pontos vencidos&quot; no extrato.
      </Text>

      <View
        style={[
          styles.row,
          {
            backgroundColor: theme.colors.elevation.level1,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <Text variant="titleMedium" style={styles.rowLabel}>
          Os pontos vencem
        </Text>
        <Switch
          value={expires}
          accessibilityLabel="Os pontos vencem"
          onValueChange={(value) => {
            setExpires(value);
            form.clearFieldError('pointsValidityDays');
          }}
        />
      </View>

      {expires ? (
        <FormField
          label="Dias sem compra paga até vencer"
          value={days}
          onChangeText={(value) => {
            setDays(value);
            form.clearFieldError('pointsValidityDays');
          }}
          error={form.fieldErrors.pointsValidityDays}
          hint={`De ${String(POINTS_VALIDITY_LIMITS.minDays)} a ${String(POINTS_VALIDITY_LIMITS.maxDays)} dias. Exemplo: 90.`}
          keyboardType="number-pad"
          maxLength={4}
        />
      ) : (
        <Text variant="bodyMedium" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
          Sem validade: os pontos ficam para sempre.
        </Text>
      )}

      <FormError message={form.formError} />

      <PrimaryButton loading={form.submitting} onPress={() => void save()}>
        Salvar
      </PrimaryButton>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontWeight: '600', lineHeight: 25, marginBottom: spacing.margem },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: spacing.folha,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    marginBottom: spacing.margem,
  },
  rowLabel: { fontWeight: '800' },
  note: { marginBottom: spacing.margem, lineHeight: 22 },
});
