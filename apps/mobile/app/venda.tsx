import {
  formatCents,
  isCoreError,
  parseCents,
  unitPriceError,
  type CustomerBalance,
  type CustomerSummary,
  type PaymentMethod,
  type Product,
  type Sale,
} from '@cvd/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Badge,
  Button,
  Dialog,
  Divider,
  IconButton,
  List,
  Portal,
  Searchbar,
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../src/core';
import { debtSinceText } from '../src/payments/debt';
import { radii, spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { BackHeader } from '../src/ui/BackHeader';
import { ConfirmDialog } from '../src/ui/ConfirmDialog';
import { FormField } from '../src/ui/FormField';
import { LoadingState } from '../src/ui/LoadingState';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { useDebounced } from '../src/ui/useDebounced';
import { useFocusQuery } from '../src/ui/useFocusQuery';

/** Um produto na venda: quantas unidades e o preço cobrado por unidade. */
interface Line {
  product: Product;
  quantity: number;
  unitPriceCents: number;
}

const MAX_QUANTITY = 999;

/** Pago agora (Pix ou dinheiro) ou fiado. */
type Settlement = PaymentMethod | 'fiado';

const failMessage = (error: unknown) =>
  isCoreError(error) ? error.message : 'Algo deu errado. Tente de novo.';

/** 1234 → "12,34", para começar a edição do preço já preenchida. */
const priceText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** Os itens de uma venda já registrada, como linhas editáveis (com as cópias da época). */
function linesOf(sale: Sale): Line[] {
  return sale.items.map((item) => ({
    product: {
      id: item.productId,
      name: item.productName,
      priceCents: item.unitPriceCents,
      points: item.points,
      canBePrize: false,
      isActive: true,
      isCombo: false,
      createdAt: sale.createdAt,
    },
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
  }));
}

/**
 * Venda no balcão: cliente opcional (sem cliente = avulsa), um toque no produto
 * soma uma unidade, toque longo ajusta quantidade e preço, e o total acompanha ao
 * vivo até finalizar no Pix, no dinheiro ou fiado (só com cliente). Com
 * `?editar=<id>`, a mesma tela corrige os itens de uma venda já registrada.
 */
export default function SaleScreen() {
  const { editar } = useLocalSearchParams<{ editar?: string }>();
  return editar ? <EditSale id={editar} /> : <SaleBuilder original={null} />;
}

function EditSale({ id }: { id: string }) {
  const load = useCallback(() => core.sales.getSale(id), [id]);
  // Uma leitura só: voltar à tela não pode desfazer o que já foi corrigido.
  const sale = useFocusQuery(load, { once: true });
  if (!sale.data) return <LoadingState query={sale} />;
  return <SaleBuilder original={sale.data} />;
}

function SaleBuilder({ original }: { original: Sale | null }) {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const loadProducts = useCallback(() => core.catalog.listProducts({ activeOnly: true }), []);
  const products = useFocusQuery(loadProducts);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [lines, setLines] = useState<Line[]>(() => (original ? linesOf(original) : []));
  const [settlement, setSettlement] = useState<Settlement>('pix');
  const [editing, setEditing] = useState<Line | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  const quantityOf = (productId: string) =>
    lines.find((line) => line.product.id === productId)?.quantity ?? 0;

  const addOne = (product: Product) => {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (!existing)
        return [...current, { product, quantity: 1, unitPriceCents: product.priceCents }];
      return current.map((line) =>
        line === existing ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + 1) } : line,
      );
    });
  };

  const removeOne = (productId: string) => {
    setLines((current) =>
      current
        .map((line) =>
          line.product.id === productId ? { ...line, quantity: line.quantity - 1 } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  // `edited` pode ser um produto que ainda não estava na venda (toque longo no cartão).
  const applyEdit = (edited: Line) => {
    setLines((current) => {
      const others = current.filter((line) => line.product.id !== edited.product.id);
      if (edited.quantity === 0) return others;
      const index = current.findIndex((line) => line.product.id === edited.product.id);
      return index === -1
        ? [...current, edited]
        : current.map((line, i) => (i === index ? edited : line));
    });
    setEditing(null);
  };

  const editProduct = (product: Product) => {
    setEditing(
      lines.find((line) => line.product.id === product.id) ?? {
        product,
        quantity: 1,
        unitPriceCents: product.priceCents,
      },
    );
  };

  // Venda avulsa não pode ser fiado: tirar o cliente volta para o Pix.
  const chooseCustomer = (chosen: CustomerSummary | null) => {
    setCustomer(chosen);
    if (!chosen && settlement === 'fiado') setSettlement('pix');
  };

  const fiado = settlement === 'fiado';

  const items = () =>
    lines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
    }));

  const fail = (error: unknown) => {
    setSubmitting(false);
    if (isCoreError(error) && error.code === 'PRODUCT_INACTIVE') void products.reload();
    const fieldErrors = isCoreError(error) ? Object.values(error.fieldErrors) : [];
    setNotice(fieldErrors[0] ?? failMessage(error));
  };

  const saveCorrection = async () => {
    if (!original || submitting) return;
    setSubmitting(true);
    try {
      await core.sales.updateSale(original.id, { items: items() });
      setConfirming(false);
      router.back();
    } catch (error) {
      setConfirming(false);
      fail(error);
    }
  };

  const finish = async () => {
    if (submitting || lines.length === 0) return;
    if (original) {
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    try {
      const sale = await core.sales.recordSale({
        customerId: customer?.id ?? null,
        items: items(),
        payment:
          settlement === 'fiado' ? { type: 'fiado' } : { type: 'paidNow', method: settlement },
      });
      router.replace({ pathname: '/vendas/[id]', params: { id: sale.id, nova: '1' } });
    } catch (error) {
      fail(error);
    }
  };

  // Na correção, a forma de pagamento não muda: o pago na hora acompanha o novo total.
  const paidNow = original?.payments.find((payment) => payment.status === 'active') ?? null;

  const productList = products.data ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <BackHeader title={original ? 'Corrigir venda' : 'Nova venda'} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {original ? (
          <FixedCustomer sale={original} />
        ) : (
          <CustomerPicker customer={customer} onChange={chooseCustomer} />
        )}

        <Text variant="titleMedium" accessibilityRole="header" style={styles.sectionTitle}>
          Produtos
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Toque para somar 1. Segure para mudar quantidade ou preço.
        </Text>

        {products.status === 'loading' ? (
          <ActivityIndicator style={styles.state} accessibilityLabel="Carregando os produtos" />
        ) : null}
        {products.status === 'error' && productList.length === 0 ? (
          <View style={styles.state}>
            <Text variant="bodyLarge" style={styles.stateText}>
              {failMessage(products.error)}
            </Text>
            <Button mode="outlined" onPress={() => void products.reload()}>
              Tentar de novo
            </Button>
          </View>
        ) : null}
        {products.status === 'ready' && productList.length === 0 ? (
          <View style={styles.state}>
            <Text variant="bodyLarge" style={styles.stateText}>
              Nenhum produto à venda. Cadastre ou ative produtos no cardápio.
            </Text>
            <Button
              mode="outlined"
              onPress={() => {
                router.push('/catalogo');
              }}
            >
              Abrir o cardápio
            </Button>
          </View>
        ) : null}

        <View style={styles.grid}>
          {productList.map((product) => (
            <ProductTile
              key={product.id}
              product={product}
              quantity={quantityOf(product.id)}
              onPress={() => {
                addOne(product);
              }}
              onLongPress={() => {
                editProduct(product);
              }}
            />
          ))}
        </View>

        {lines.length > 0 ? (
          <>
            <Text variant="titleMedium" accessibilityRole="header" style={styles.sectionTitle}>
              Na venda
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
              {lines.map((line, index) => (
                <View key={line.product.id}>
                  {index > 0 ? (
                    <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
                  ) : null}
                  <LineRow
                    line={line}
                    onPress={() => {
                      setEditing(line);
                    }}
                    onRemoveOne={() => {
                      removeOne(line.product.id);
                    }}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.elevation.level2,
            borderColor: theme.colors.outlineVariant,
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}
      >
        <View style={styles.totalRow}>
          <View>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Total
            </Text>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {units === 1 ? '1 item' : `${String(units)} itens`}
            </Text>
          </View>
          <Text
            variant="headlineLarge"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Total ${formatCents(total)}`}
            style={{ color: theme.colors.primary }}
          >
            {formatCents(total)}
          </Text>
        </View>
        {original ? (
          <Text
            variant="bodyMedium"
            style={[styles.payNote, { color: theme.colors.onSurfaceVariant }]}
          >
            {paidNow
              ? `Pago na hora no ${paidNow.method === 'pix' ? 'Pix' : 'dinheiro'}: o pagamento passa a ser do novo total.`
              : original.customer
                ? `Na conta de ${original.customer.name}: o saldo devedor acompanha o novo total.`
                : 'O total da venda muda.'}
          </Text>
        ) : (
          <SegmentedButtons
            value={settlement}
            onValueChange={(value) => {
              setSettlement(value);
            }}
            buttons={[
              { value: 'pix', label: 'Pix', icon: 'qrcode' },
              { value: 'cash', label: 'Dinheiro', icon: 'cash' },
              {
                value: 'fiado',
                label: 'Fiado',
                icon: 'notebook-outline',
                disabled: !customer,
                accessibilityLabel: customer ? 'Fiado' : 'Fiado: escolha o cliente primeiro',
              },
            ]}
            style={styles.methods}
          />
        )}
        <PrimaryButton
          icon={original ? 'content-save-outline' : fiado ? 'notebook-outline' : 'check'}
          onPress={finish}
          loading={submitting}
          disabled={submitting || lines.length === 0}
        >
          {original
            ? 'Salvar correção'
            : fiado
              ? 'Fiado · anotar na conta'
              : 'Pago agora · finalizar'}
        </PrimaryButton>
      </View>

      {original ? (
        <ConfirmDialog
          visible={confirming}
          title="Salvar a correção?"
          message={
            original.totalCents === total
              ? 'Os itens da venda serão trocados por estes. O total continua o mesmo.'
              : `O total passa de ${formatCents(original.totalCents)} para ${formatCents(total)}. Se a compra já tinha dado pontos, eles são recalculados.`
          }
          confirmLabel="Salvar"
          dismissLabel="Voltar"
          tone="default"
          busy={submitting}
          onConfirm={() => void saveCorrection()}
          onDismiss={() => {
            setConfirming(false);
          }}
        />
      ) : null}

      <LineEditor
        line={editing}
        onDismiss={() => {
          setEditing(null);
        }}
        onApply={applyEdit}
      />

      <Snackbar
        visible={notice !== null}
        onDismiss={() => {
          setNotice(null);
        }}
        duration={3500}
        style={{ backgroundColor: theme.colors.inverseSurface }}
      >
        {notice ?? ''}
      </Snackbar>
    </View>
  );
}

/** Na correção, o cliente da venda não muda. */
function FixedCustomer({ sale }: { sale: Sale }) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.elevation.level1,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      <List.Item
        title={sale.customer ? sale.customer.name : 'Venda avulsa'}
        description={`Venda de ${formatCents(sale.totalCents)}. Mude os itens, as quantidades ou os preços.`}
        left={(props) => (
          <List.Icon
            {...props}
            icon={sale.customer ? 'account-check-outline' : 'storefront-outline'}
          />
        )}
        titleStyle={styles.customerName}
        descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
        descriptionNumberOfLines={2}
      />
    </View>
  );
}

/** Busca de cliente; sem ninguém escolhido, a venda é avulsa. */
function CustomerPicker({
  customer,
  onChange,
}: {
  customer: CustomerSummary | null;
  onChange: (customer: CustomerSummary | null) => void;
}) {
  const theme = useAppTheme();
  const [text, setText] = useState('');
  const search = useDebounced(text);
  const query = search.trim();
  // Resultado da última busca respondida; a busca em andamento é a que ainda não voltou.
  const [found, setFound] = useState<{ query: string; results: CustomerSummary[] } | null>(null);
  const loading = query !== '' && found?.query !== query;
  const results = query !== '' && found?.query === query ? found.results : [];

  useEffect(() => {
    if (query === '') return;
    let current = true;
    core.customers
      .searchCustomers(query)
      .then((list) => {
        if (current) setFound({ query, results: list.slice(0, 5) });
      })
      .catch(() => {
        if (current) setFound({ query, results: [] });
      });
    return () => {
      current = false;
    };
  }, [query]);

  const cardStyle = [
    styles.card,
    { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant },
  ];

  if (customer) {
    return (
      <View style={cardStyle}>
        <List.Item
          title={customer.name}
          description={() => <BalanceLine customer={customer} />}
          left={(props) => <List.Icon {...props} icon="account-check-outline" />}
          right={() => (
            <IconButton
              icon="close"
              accessibilityLabel="Tirar o cliente (venda avulsa)"
              onPress={() => {
                onChange(null);
              }}
            />
          )}
          titleStyle={styles.customerName}
          descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
        />
      </View>
    );
  }

  const typed = query !== '';
  return (
    <View>
      <Searchbar
        placeholder="Cliente: buscar pelo nome"
        value={text}
        onChangeText={setText}
        autoCorrect={false}
        loading={loading}
        style={[
          styles.search,
          { backgroundColor: theme.colors.elevation.level2, borderColor: theme.colors.outline },
        ]}
        inputStyle={styles.searchInput}
      />
      {typed && results.length > 0 ? (
        <View style={cardStyle}>
          {results.map((found, index) => (
            <View key={found.id}>
              {index > 0 ? (
                <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
              ) : null}
              <List.Item
                title={found.name}
                description={found.reference ?? undefined}
                onPress={() => {
                  setText('');
                  onChange(found);
                }}
                titleStyle={styles.customerName}
                descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              />
            </View>
          ))}
        </View>
      ) : null}
      <Text variant="bodyMedium" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        {typed && !loading && results.length === 0
          ? `Ninguém com “${query}”. Sem cliente, a venda fica avulsa e não pode ser fiado.`
          : 'Sem cliente, a venda fica avulsa e não pode ser fiado.'}
      </Text>
    </View>
  );
}

/** O saldo devedor do cliente escolhido, para lembrar da dívida no balcão. */
function BalanceLine({ customer }: { customer: CustomerSummary }) {
  const theme = useAppTheme();
  // Saldo do último cliente lido; o do cliente atual ainda não chegou se o id difere.
  const [read, setRead] = useState<{ id: string; balance: CustomerBalance | null } | null>(null);
  const current = read?.id === customer.id ? read : null;

  useEffect(() => {
    let active = true;
    core.payments
      .getCustomerBalance(customer.id)
      .then((balance) => {
        if (active) setRead({ id: customer.id, balance });
      })
      .catch(() => {
        if (active) setRead({ id: customer.id, balance: null });
      });
    return () => {
      active = false;
    };
  }, [customer.id]);

  const muted = { color: theme.colors.onSurfaceVariant };
  if (!current) {
    return (
      <Text variant="bodyMedium" style={muted}>
        Conferindo o saldo devedor…
      </Text>
    );
  }
  if (!current.balance) {
    return (
      <Text variant="bodyMedium" style={muted}>
        Não deu para ver o saldo devedor agora.
      </Text>
    );
  }
  const { balance } = current;
  if (balance.balanceCents === 0) {
    return (
      <Text variant="bodyMedium" style={muted}>
        {customer.reference ? `${customer.reference} · ` : ''}Não deve nada
      </Text>
    );
  }
  return (
    <View accessibilityLiveRegion="polite">
      <Text variant="bodyLarge" style={[styles.debt, { color: theme.colors.primary }]}>
        Deve {formatCents(balance.balanceCents)}
      </Text>
      <Text variant="bodyMedium" style={muted}>
        {debtSinceText(balance)}
      </Text>
    </View>
  );
}

function ProductTile({
  product,
  quantity,
  onPress,
  onLongPress,
}: {
  product: Product;
  quantity: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useAppTheme();
  const chosen = quantity > 0;
  return (
    <TouchableRipple
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatCents(product.priceCents)}${
        chosen ? `, ${String(quantity)} na venda` : ''
      }`}
      accessibilityHint="Toque para somar 1. Segure para mudar quantidade ou preço."
      borderless
      style={[
        styles.tile,
        {
          backgroundColor: chosen ? theme.colors.primaryContainer : theme.colors.elevation.level1,
          borderColor: chosen ? theme.colors.primary : theme.colors.outlineVariant,
        },
      ]}
    >
      <View>
        <Text variant="titleMedium" numberOfLines={2} style={styles.tileName}>
          {product.name}
        </Text>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {formatCents(product.priceCents)}
        </Text>
        {chosen ? (
          <Badge
            size={28}
            style={[
              styles.badge,
              { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary },
            ]}
          >
            {quantity}
          </Badge>
        ) : null}
      </View>
    </TouchableRipple>
  );
}

function LineRow({
  line,
  onPress,
  onRemoveOne,
}: {
  line: Line;
  onPress: () => void;
  onRemoveOne: () => void;
}) {
  const theme = useAppTheme();
  const edited = line.unitPriceCents !== line.product.priceCents;
  return (
    <View style={styles.lineRow}>
      <TouchableRipple
        onPress={onPress}
        accessibilityRole="button"
        accessibilityHint="Abre para mudar quantidade ou preço"
        style={styles.lineMain}
      >
        <View>
          <Text variant="titleMedium">
            {String(line.quantity)}× {line.product.name}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: edited ? theme.colors.primary : theme.colors.onSurfaceVariant }}
          >
            {edited
              ? `${formatCents(line.unitPriceCents)} cada (de ${formatCents(line.product.priceCents)})`
              : `${formatCents(line.unitPriceCents)} cada`}
          </Text>
        </View>
      </TouchableRipple>
      <Text variant="titleMedium" style={styles.lineTotal}>
        {formatCents(line.quantity * line.unitPriceCents)}
      </Text>
      <IconButton
        icon="minus"
        mode="outlined"
        accessibilityLabel={`Tirar 1 ${line.product.name}`}
        onPress={onRemoveOne}
      />
    </View>
  );
}

/** Ajuste de um item: quantidade e preço de cada unidade (promoção, desconto). */
function LineEditor({
  line,
  onDismiss,
  onApply,
}: {
  line: Line | null;
  onDismiss: () => void;
  onApply: (edited: Line) => void;
}) {
  return (
    <Portal>
      <Dialog visible={line !== null} onDismiss={onDismiss} style={styles.dialog}>
        {/* Monta de novo a cada abertura, já com a quantidade e o preço do item. */}
        {line ? <LineEditorBody line={line} onApply={onApply} /> : null}
      </Dialog>
    </Portal>
  );
}

function LineEditorBody({ line, onApply }: { line: Line; onApply: (edited: Line) => void }) {
  const theme = useAppTheme();
  const [quantity, setQuantity] = useState(line.quantity);
  const [price, setPrice] = useState(() => priceText(line.unitPriceCents));
  const [tried, setTried] = useState(false);

  const cents = parseCents(price) ?? Number.NaN;
  const priceError = unitPriceError(cents);

  const apply = () => {
    setTried(true);
    if (priceError) return;
    onApply({ ...line, quantity, unitPriceCents: cents });
  };

  return (
    <>
      <Dialog.Title>{line.product.name}</Dialog.Title>
      <Dialog.Content>
        <View style={styles.stepper}>
          <IconButton
            icon="minus"
            mode="outlined"
            size={28}
            accessibilityLabel="Menos 1"
            disabled={quantity <= 1}
            onPress={() => {
              setQuantity((value) => Math.max(1, value - 1));
            }}
          />
          <Text
            variant="headlineMedium"
            accessibilityLabel={`Quantidade ${String(quantity)}`}
            style={styles.stepperValue}
          >
            {quantity}
          </Text>
          <IconButton
            icon="plus"
            mode="outlined"
            size={28}
            accessibilityLabel="Mais 1"
            disabled={quantity >= MAX_QUANTITY}
            onPress={() => {
              setQuantity((value) => Math.min(MAX_QUANTITY, value + 1));
            }}
          />
        </View>
        <FormField
          label="Preço de cada"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          left={<TextInput.Affix text="R$" />}
          error={tried ? (priceError ?? undefined) : undefined}
          hint={
            line.product.priceCents !== cents
              ? `Preço do cardápio: ${formatCents(line.product.priceCents)}`
              : 'Mude para dar um desconto nesta venda.'
          }
          onSubmitEditing={apply}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Button
          textColor={theme.colors.error}
          onPress={() => {
            onApply({ ...line, quantity: 0 });
          }}
        >
          Tirar da venda
        </Button>
        <Button mode="contained" onPress={apply} style={styles.applyButton}>
          Aplicar
        </Button>
      </Dialog.Actions>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.margem,
    paddingTop: spacing.xs,
    paddingBottom: spacing.secao,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  search: { borderRadius: radii.campo, borderWidth: 1, elevation: 0 },
  searchInput: { fontSize: 17 },
  hint: { marginTop: spacing.sm },
  customerName: { fontSize: 17, fontWeight: '700' },
  debt: { fontWeight: '800' },
  sectionTitle: { marginTop: spacing.secao - spacing.gap, marginBottom: spacing.xs },
  state: { marginTop: spacing.secao, alignItems: 'center', gap: spacing.md },
  stateText: { textAlign: 'center', fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.gap,
    marginTop: spacing.gap,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 88,
    padding: spacing.md,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  tileName: { paddingRight: 30, fontWeight: '800' },
  badge: { position: 'absolute', top: -4, right: -4, fontWeight: '800', fontSize: 15 },
  card: {
    marginTop: spacing.gap,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  lineRow: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.xs },
  lineMain: { flex: 1, paddingVertical: spacing.md, paddingLeft: spacing.margem },
  lineTotal: { marginHorizontal: spacing.sm },
  bar: {
    borderTopWidth: 1.5,
    paddingHorizontal: spacing.margem,
    paddingTop: spacing.md,
    gap: spacing.gap,
  },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  methods: { marginBottom: spacing.xs },
  payNote: { fontWeight: '600' },
  dialog: { borderRadius: radii.cartao },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.margem,
    marginBottom: spacing.md,
  },
  stepperValue: { minWidth: 56, textAlign: 'center' },
  applyButton: { borderRadius: radii.botao, paddingHorizontal: spacing.sm },
});
