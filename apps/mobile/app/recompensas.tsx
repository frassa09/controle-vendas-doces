import { REWARD_LIMITS } from '@cvd/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { core } from '../src/core';
import { useSession } from '../src/session/SessionProvider';
import { spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { BackHeader } from '../src/ui/BackHeader';
import { FormError } from '../src/ui/FormError';
import { FormField } from '../src/ui/FormField';
import { FormScreen } from '../src/ui/FormScreen';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { useCoreForm } from '../src/ui/useCoreForm';

/** Regras de fidelidade: quantos pontos custa trocar por um produto grátis. */
export default function RewardSettingsScreen() {
  const session = useSession();
  const router = useRouter();
  const theme = useAppTheme();
  const form = useCoreForm<'redeemCost'>();
  const current = session.state.status === 'ready' ? session.state.store.redeemCost : null;
  const [redeemCost, setRedeemCost] = useState(() =>
    String(current ?? REWARD_LIMITS.redeemCost.default),
  );

  const save = () =>
    form.submit(async () => {
      const text = redeemCost.trim();
      const saved = await core.store.updateRewardSettings({
        redeemCost: /^\d+$/.test(text) ? Number(text) : NaN,
      });
      session.storeUpdated(saved);
      router.back();
    });

  return (
    <FormScreen header={<BackHeader title="Recompensas" />}>
      <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
        Na página dele, o cliente troca os pontos por um dos produtos marcados como prêmio no
        cardápio. O prêmio vira um cupom, que aparece aqui no app na próxima venda.
      </Text>

      <FormField
        label="Pontos para trocar por um produto"
        value={redeemCost}
        onChangeText={(text) => {
          setRedeemCost(text);
          form.clearFieldError('redeemCost');
        }}
        error={form.fieldErrors.redeemCost}
        hint={`Padrão: ${String(REWARD_LIMITS.redeemCost.default)} pontos.`}
        keyboardType="number-pad"
        maxLength={4}
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />

      <FormError message={form.formError} />

      <PrimaryButton loading={form.submitting} onPress={() => void save()}>
        Salvar
      </PrimaryButton>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontWeight: '600', lineHeight: 25, marginBottom: spacing.margem },
});
