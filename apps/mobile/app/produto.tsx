import {
  formatCents,
  isCoreError,
  parseCents,
  PRODUCT_LIMITS,
  type Product,
  type ProductField,
} from '@cvd/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Switch, Text, TextInput } from 'react-native-paper';
import { core } from '../src/core';
import { radii, spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { BackHeader } from '../src/ui/BackHeader';
import { FormError } from '../src/ui/FormError';
import { FormField, type FormFieldHandle } from '../src/ui/FormField';
import { FormScreen } from '../src/ui/FormScreen';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { LoadingState } from '../src/ui/LoadingState';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useCoreForm } from '../src/ui/useCoreForm';
import { useFocusQuery } from '../src/ui/useFocusQuery';

/** "8,50" sem o "R$" (o campo já mostra o prefixo). */
const priceText = (cents: number) => formatCents(cents).replace('R$ ', '');

/** Pontos digitados: vazio é 0; qualquer coisa que não seja inteiro o core recusa. */
const parsePoints = (text: string) => {
  const value = text.trim();
  if (value === '') return 0;
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
};

/** Cadastro e edição de produto ou combo. Com `id`, edita; sem, cadastra. */
export default function ProductFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return typeof id === 'string' && id !== '' ? (
    <EditProduct id={id} />
  ) : (
    <ProductForm product={null} />
  );
}

function EditProduct({ id }: { id: string }) {
  const load = useCallback(() => core.catalog.getProduct(id), [id]);
  // Lê uma vez só: voltar ao foco não pode apagar o que já foi digitado.
  const query = useFocusQuery(load, { once: true });
  if (!query.data) return <LoadingState query={query} />;
  return <ProductForm product={query.data} />;
}

function ProductForm({ product }: { product: Product | null }) {
  const theme = useAppTheme();
  const form = useCoreForm<ProductField>();
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product ? priceText(product.priceCents) : '');
  const [points, setPoints] = useState(product ? String(product.points) : '0');
  const [isCombo, setIsCombo] = useState(product?.isCombo ?? false);
  const [canBePrize, setCanBePrize] = useState(product?.canBePrize ?? false);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [switching, setSwitching] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);
  const priceRef = useRef<FormFieldHandle>(null);
  const pointsRef = useRef<FormFieldHandle>(null);

  const save = () =>
    form.submit(async () => {
      const input = {
        name,
        priceCents: parseCents(price) ?? Number.NaN,
        points: parsePoints(points),
        isCombo,
        canBePrize,
      };
      if (product) await core.catalog.updateProduct(product.id, input);
      else await core.catalog.createProduct(input);
      router.back();
    });

  // Ativar e desativar vale na hora, como na lista; o resto só ao salvar.
  const toggleActive = async () => {
    if (!product || switching) return;
    setSwitching(true);
    setActiveError(null);
    try {
      const updated = isActive
        ? await core.catalog.deactivateProduct(product.id)
        : await core.catalog.activateProduct(product.id);
      setIsActive(updated.isActive);
    } catch (error) {
      setActiveError(isCoreError(error) ? error.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setSwitching(false);
    }
  };

  const title = product
    ? isCombo
      ? 'Editar combo'
      : 'Editar produto'
    : isCombo
      ? 'Novo combo'
      : 'Novo produto';

  return (
    <FormScreen header={<BackHeader />}>
      <ScreenHeader
        title={title}
        lead={
          product
            ? 'Mudar preço ou pontos não altera as vendas já registradas.'
            : 'Aparece na tela de venda assim que você salvar.'
        }
      />

      <FormField
        label={isCombo ? 'Nome do combo' : 'Nome'}
        value={name}
        onChangeText={(text) => {
          setName(text);
          form.clearFieldError('name');
        }}
        error={form.fieldErrors.name}
        hint={isCombo ? 'Ex.: 3 brownies' : 'Ex.: Brownie de nozes'}
        maxLength={PRODUCT_LIMITS.name}
        autoCapitalize="sentences"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => priceRef.current?.focus()}
      />
      <FormField
        ref={priceRef}
        label="Preço"
        value={price}
        onChangeText={(text) => {
          setPrice(text);
          form.clearFieldError('priceCents');
        }}
        error={form.fieldErrors.priceCents}
        hint={isCombo ? 'O preço do combo inteiro.' : 'O preço de uma unidade.'}
        left={<TextInput.Affix text="R$" />}
        keyboardType="decimal-pad"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => pointsRef.current?.focus()}
      />
      <FormField
        ref={pointsRef}
        label="Pontos que gera"
        value={points}
        onChangeText={(text) => {
          setPoints(text);
          form.clearFieldError('points');
        }}
        error={form.fieldErrors.points}
        hint="Creditados ao cliente quando a compra estiver paga. 0 para nenhum."
        keyboardType="number-pad"
        maxLength={4}
        returnKeyType="done"
      />

      <View
        style={[
          styles.options,
          {
            backgroundColor: theme.colors.elevation.level1,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <Option
          title="É um combo"
          description="Vários doces por um preço só, com pontos próprios."
          value={isCombo}
          onChange={setIsCombo}
        />
        <Option
          title="Pode ser prêmio"
          description="O cliente pode escolher como prêmio da fidelidade."
          value={canBePrize}
          onChange={setCanBePrize}
          divider
        />
        {product ? (
          <Option
            title="À venda"
            description={
              isActive
                ? 'Aparece na tela de venda.'
                : 'Fora da venda. Continua no cardápio e no histórico.'
            }
            value={isActive}
            onChange={() => void toggleActive()}
            busy={switching}
            divider
          />
        ) : null}
      </View>
      <FormError message={activeError ?? form.formError} />

      <PrimaryButton loading={form.submitting} onPress={save}>
        {product ? 'Salvar alterações' : isCombo ? 'Cadastrar combo' : 'Cadastrar produto'}
      </PrimaryButton>
      <Button
        mode="text"
        onPress={() => {
          router.back();
        }}
        labelStyle={styles.cancel}
        style={styles.cancelButton}
      >
        Cancelar
      </Button>
    </FormScreen>
  );
}

function Option({
  title,
  description,
  value,
  onChange,
  busy = false,
  divider = false,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  busy?: boolean;
  divider?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.option,
        divider && { borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant },
      ]}
    >
      <View style={styles.optionText}>
        <Text variant="titleMedium">{title}</Text>
        <Text
          variant="bodyMedium"
          style={[styles.optionDescription, { color: theme.colors.onSurfaceVariant }]}
        >
          {description}
        </Text>
      </View>
      <View style={styles.optionSwitch}>
        {busy ? (
          <ActivityIndicator size="small" accessibilityLabel="Salvando" />
        ) : (
          <Switch value={value} onValueChange={onChange} accessibilityLabel={title} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingVertical: spacing.md,
    paddingLeft: spacing.margem,
  },
  optionText: { flex: 1, gap: 2 },
  optionDescription: { fontWeight: '600' },
  optionSwitch: { width: 64, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { marginTop: spacing.gap, alignSelf: 'center' },
  cancel: { fontSize: 16, marginVertical: 14 },
});
