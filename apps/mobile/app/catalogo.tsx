import { formatCents, isCoreError, type Product } from '@cvd/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Divider,
  FAB,
  Snackbar,
  Switch,
  Text,
  TouchableRipple,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../src/core';
import { radii, spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { PrimaryButton } from '../src/ui/PrimaryButton';

type Load =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'loaded'; products: Product[] };

const failMessage = (error: unknown) =>
  isCoreError(error) ? error.message : 'Algo deu errado. Tente de novo.';

/** O cardápio da loja: o que está à venda e o que foi tirado da venda. */
export default function CatalogScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoad({ status: 'loaded', products: await core.catalog.listProducts() });
    } catch (error) {
      setLoad({ status: 'failed', message: failMessage(error) });
    }
  }, []);

  // Volta do formulário com o produto salvo: recarrega.
  useFocusEffect(
    useCallback(() => {
      void fetchProducts();
    }, [fetchProducts]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  };

  const toggleActive = async (product: Product) => {
    if (toggling) return;
    setToggling(product.id);
    try {
      const updated = product.isActive
        ? await core.catalog.deactivateProduct(product.id)
        : await core.catalog.activateProduct(product.id);
      setNotice(
        updated.isActive
          ? `${updated.name} voltou para a venda.`
          : `${updated.name} saiu da venda. O histórico continua.`,
      );
      await fetchProducts();
    } catch (error) {
      setNotice(failMessage(error));
    } finally {
      setToggling(null);
    }
  };

  const openNew = () => {
    router.push('/produto');
  };

  const products = load.status === 'loaded' ? load.products : [];
  const active = products.filter((product) => product.isActive);
  const inactive = products.filter((product) => !product.isActive);

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header
        style={{ backgroundColor: theme.colors.background }}
        statusBarHeight={insets.top}
      >
        <Appbar.BackAction
          accessibilityLabel="Voltar"
          onPress={() => {
            router.back();
          }}
        />
        <Appbar.Content title="" />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 112 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text
          variant="headlineLarge"
          accessibilityRole="header"
          style={{ color: theme.colors.primary }}
        >
          Cardápio
        </Text>
        <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
          Produtos e combos que aparecem na hora de vender.
        </Text>

        {load.status === 'loading' ? (
          <ActivityIndicator style={styles.state} accessibilityLabel="Carregando o cardápio" />
        ) : null}

        {load.status === 'failed' ? (
          <View style={styles.state}>
            <Text variant="bodyLarge" style={styles.stateText}>
              {load.message}
            </Text>
            <Button mode="outlined" onPress={refresh} style={styles.retry}>
              Tentar de novo
            </Button>
          </View>
        ) : null}

        {load.status === 'loaded' && products.length === 0 ? (
          <View style={styles.state}>
            <Text variant="titleMedium" style={styles.stateText}>
              Nenhum produto ainda.
            </Text>
            <Text
              variant="bodyLarge"
              style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}
            >
              Cadastre os doces que você vende e os combos, como 3 brownies por R$ 8,00.
            </Text>
            <PrimaryButton icon="plus" onPress={openNew} style={styles.emptyAction}>
              Cadastrar o primeiro
            </PrimaryButton>
          </View>
        ) : null}

        {active.length > 0 ? (
          <ProductSection
            title="À venda"
            products={active}
            toggling={toggling}
            onToggle={toggleActive}
          />
        ) : null}
        {inactive.length > 0 ? (
          <ProductSection
            title="Fora da venda"
            note="Não aparecem na venda, mas continuam no histórico."
            products={inactive}
            toggling={toggling}
            onToggle={toggleActive}
          />
        ) : null}
      </ScrollView>

      {products.length > 0 ? (
        <FAB
          icon="plus"
          label="Novo produto"
          onPress={openNew}
          color={theme.colors.onPrimary}
          style={[
            styles.fab,
            { backgroundColor: theme.colors.primary, bottom: insets.bottom + spacing.margem },
          ]}
        />
      ) : null}

      <Snackbar
        visible={notice !== null}
        onDismiss={() => {
          setNotice(null);
        }}
        duration={2600}
        style={{ backgroundColor: theme.colors.inverseSurface, marginBottom: insets.bottom + 80 }}
      >
        {notice ?? ''}
      </Snackbar>
    </View>
  );
}

function ProductSection({
  title,
  note,
  products,
  toggling,
  onToggle,
}: {
  title: string;
  note?: string;
  products: Product[];
  toggling: string | null;
  onToggle: (product: Product) => Promise<void>;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.section}>
      <Text variant="titleMedium" accessibilityRole="header">
        {title}
      </Text>
      {note ? (
        <Text variant="bodyMedium" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
          {note}
        </Text>
      ) : null}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.elevation.level1,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        {products.map((product, index) => (
          <View key={product.id}>
            {index > 0 ? (
              <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
            ) : null}
            <ProductRow
              product={product}
              busy={toggling === product.id}
              onToggle={() => onToggle(product)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function ProductRow({
  product,
  busy,
  onToggle,
}: {
  product: Product;
  busy: boolean;
  onToggle: () => Promise<void>;
}) {
  const theme = useAppTheme();
  const muted = theme.colors.onSurfaceVariant;
  const tags = [
    product.isCombo ? 'Combo' : null,
    product.points > 0 ? pointsLabel(product.points) : null,
    product.canBePrize ? 'Pode ser prêmio' : null,
  ].filter((tag) => tag !== null);

  return (
    <View style={styles.row}>
      <TouchableRipple
        style={styles.rowMain}
        accessibilityRole="button"
        accessibilityHint="Abre para editar"
        onPress={() => {
          router.push({ pathname: '/produto', params: { id: product.id } });
        }}
      >
        <View>
          <Text
            variant="titleMedium"
            style={[styles.rowName, !product.isActive && { color: muted }]}
          >
            {product.name}
          </Text>
          <Text variant="bodyLarge" style={[styles.price, { color: theme.colors.onSurface }]}>
            {formatCents(product.priceCents)}
          </Text>
          {tags.length > 0 ? (
            <Text variant="labelMedium" style={[styles.tags, { color: muted }]}>
              {tags.join(' · ')}
            </Text>
          ) : null}
        </View>
      </TouchableRipple>
      <View style={styles.switch}>
        {busy ? (
          <ActivityIndicator size="small" accessibilityLabel="Salvando" />
        ) : (
          <Switch
            value={product.isActive}
            onValueChange={() => void onToggle()}
            accessibilityLabel={`${product.name} à venda`}
          />
        )}
      </View>
    </View>
  );
}

function pointsLabel(points: number): string {
  return points === 1 ? '1 ponto' : `${String(points)} pontos`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.folha,
    paddingTop: spacing.xs,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  lead: { marginTop: spacing.gap, fontWeight: '600' },
  state: { marginTop: spacing.secao, gap: spacing.gap },
  stateText: { textAlign: 'left' },
  retry: { alignSelf: 'flex-start', marginTop: spacing.xs },
  emptyAction: { marginTop: spacing.md },
  section: { marginTop: spacing.secao, gap: spacing.sm },
  note: { fontWeight: '600' },
  card: {
    marginTop: spacing.xs,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowMain: {
    flex: 1,
    minHeight: 72,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingLeft: spacing.margem,
    paddingRight: spacing.sm,
  },
  rowName: { fontSize: 17 },
  price: { marginTop: 2, fontVariant: ['tabular-nums'], fontWeight: '600' },
  tags: { marginTop: 2, fontSize: 14 },
  switch: { width: 64, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: spacing.margem, borderRadius: radii.botao },
});
