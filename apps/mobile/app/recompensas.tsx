import { formatCents, REWARD_LIMITS, scratchAverageCost } from '@cvd/core';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, SegmentedButtons, Text } from 'react-native-paper';
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
import { useFocusQuery } from '../src/ui/useFocusQuery';

/** Chances oferecidas: baixas de propósito, a raspadinha é um agrado e não o centro. */
const CHANCES = [5, 10, 15, 20, 25];

type Field = 'redeemCost' | 'scratchCost' | 'scratchWinPercent';

function wholeNumber(text: string): number {
  const clean = text.trim();
  return /^\d+$/.test(clean) ? Number(clean) : NaN;
}

/** Regras de fidelidade: custo da troca direta e custo e chance da raspadinha. */
export default function RewardSettingsScreen() {
  const session = useSession();
  const router = useRouter();
  const theme = useAppTheme();
  const form = useCoreForm<Field>();
  const store = session.state.status === 'ready' ? session.state.store : null;
  const [redeemCost, setRedeemCost] = useState(() =>
    String(store?.redeemCost ?? REWARD_LIMITS.redeemCost.default),
  );
  const [scratchCost, setScratchCost] = useState(() =>
    String(store?.scratchCost ?? REWARD_LIMITS.scratchCost.default),
  );
  const [chance, setChance] = useState(
    () => store?.scratchWinPercent ?? REWARD_LIMITS.scratchWinPercent.default,
  );
  // Uma chance salva fora da lista (ex.: 0%) continua aparecendo como opção.
  const chances = CHANCES.includes(chance) ? CHANCES : [...CHANCES, chance].sort((a, b) => a - b);

  const loadProducts = useCallback(() => core.catalog.listProducts({ activeOnly: true }), []);
  const products = useFocusQuery(loadProducts);
  const average =
    products.data === undefined
      ? null
      : scratchAverageCost({ winPercent: chance, products: products.data });

  const save = () =>
    form.submit(async () => {
      const saved = await core.store.updateRewardSettings({
        redeemCost: wholeNumber(redeemCost),
        scratchCost: wholeNumber(scratchCost),
        scratchWinPercent: chance,
      });
      session.storeUpdated(saved);
      router.back();
    });

  return (
    <FormScreen header={<BackHeader title="Recompensas" />}>
      <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
        Na página dele, o cliente troca os pontos por um dos produtos marcados como prêmio no
        cardápio, ou tenta a sorte na raspadinha. O prêmio vira um cupom, que aparece aqui no app na
        próxima venda.
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
        returnKeyType="next"
      />

      <Text variant="titleMedium" style={[styles.section, { color: theme.colors.onSurface }]}>
        Raspadinha
      </Text>

      <FormField
        label="Pontos por raspadinha"
        value={scratchCost}
        onChangeText={(text) => {
          setScratchCost(text);
          form.clearFieldError('scratchCost');
        }}
        error={form.fieldErrors.scratchCost}
        hint={`Padrão: ${String(REWARD_LIMITS.scratchCost.default)} pontos.`}
        keyboardType="number-pad"
        maxLength={4}
        returnKeyType="done"
      />

      <Text variant="labelLarge" style={[styles.label, { color: theme.colors.onSurface }]}>
        Chance de ganhar um produto
      </Text>
      <SegmentedButtons
        value={String(chance)}
        onValueChange={(value) => {
          setChance(Number(value));
          form.clearFieldError('scratchWinPercent');
        }}
        buttons={chances.map((option) => ({
          value: String(option),
          label: `${String(option)}%`,
          accessibilityLabel: `${String(option)} por cento`,
        }))}
      />
      <HelperText type={form.fieldErrors.scratchWinPercent ? 'error' : 'info'}>
        {form.fieldErrors.scratchWinPercent ??
          (chance > 0
            ? `Em média, 1 a cada ${String(Math.round(100 / chance))} raspadinhas ganha.`
            : 'Com 0%, ninguém ganha.')}
      </HelperText>

      <View
        style={[
          styles.cost,
          {
            backgroundColor: theme.colors.surfaceVariant,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        {average === null ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {products.status === 'error'
              ? 'Não deu para ler o cardápio agora.'
              : 'Calculando o custo médio…'}
          </Text>
        ) : average.worstPrize ? (
          <>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Custo médio por raspadinha
            </Text>
            <Text variant="headlineSmall" style={{ color: theme.colors.primary }}>
              até {formatCents(average.averageCents)}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Pior caso: todo ganhador escolhe {average.worstPrize.name} (
              {formatCents(average.worstPrize.priceCents)}), o prêmio mais caro.
            </Text>
          </>
        ) : (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Nenhum produto ativo está marcado como prêmio. Sem prêmio, a raspadinha fica fechada na
            página do cliente.
          </Text>
        )}
      </View>

      <FormError message={form.formError} />

      <PrimaryButton loading={form.submitting} onPress={() => void save()}>
        Salvar
      </PrimaryButton>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontWeight: '600', lineHeight: 25, marginBottom: spacing.margem },
  section: { fontWeight: '800', marginTop: spacing.margem, marginBottom: spacing.gap },
  label: { marginBottom: spacing.gap },
  cost: {
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    padding: spacing.margem,
    gap: 4,
    marginTop: spacing.gap,
    marginBottom: spacing.margem,
  },
});
