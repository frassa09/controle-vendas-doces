import { formatWhatsApp, isCoreError, type CustomerSummary } from '@cvd/core';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Divider, FAB, List, Searchbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../../src/core';
import { radii, spacing } from '../../src/theme/theme';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { BackHeader } from '../../src/ui/BackHeader';
import { useFocusQuery } from '../../src/ui/useFocusQuery';

/** Espera a pessoa parar de digitar antes de buscar. */
function useDebounced(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  return debounced;
}

/** Lista de clientes com busca por nome ou referência, para achar alguém no balcão. */
export default function CustomersScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const search = useDebounced(text);
  const load = useCallback(() => core.customers.searchCustomers(search), [search]);
  const query = useFocusQuery(load);
  const customers = query.data ?? [];
  const searching = search.trim() !== '';

  const openNew = () => {
    router.push('/clientes/novo');
  };

  const renderItem = ({ item }: { item: CustomerSummary }) => (
    <List.Item
      title={item.name}
      description={
        item.reference
          ? `${item.reference} · ${formatWhatsApp(item.whatsapp)}`
          : formatWhatsApp(item.whatsapp)
      }
      onPress={() => {
        router.push({ pathname: '/clientes/[id]', params: { id: item.id } });
      }}
      titleStyle={styles.itemTitle}
      descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
      right={(props) => <List.Icon {...props} icon="chevron-right" />}
      style={styles.item}
    />
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <BackHeader title="Clientes" />
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Buscar por nome ou referência"
          value={text}
          onChangeText={setText}
          autoCorrect={false}
          style={[
            styles.search,
            { backgroundColor: theme.colors.elevation.level2, borderColor: theme.colors.outline },
          ]}
          inputStyle={styles.searchInput}
          loading={query.status === 'loading' && searching}
        />
      </View>

      {query.status === 'error' && customers.length === 0 ? (
        <Message
          text={
            isCoreError(query.error)
              ? query.error.message
              : 'Não deu para carregar os clientes. Tente de novo.'
          }
          action={{ label: 'Tentar de novo', onPress: () => void query.reload() }}
        />
      ) : query.status !== 'loading' && customers.length === 0 ? (
        searching ? (
          <Message text={`Ninguém com “${search.trim()}”. Confira a grafia ou cadastre.`} />
        ) : (
          <Message
            title="Nenhum cliente ainda"
            text="Cadastre quem compra com você para registrar vendas fiado e cobrar pelo WhatsApp."
          />
        )
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => (
            <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
          )}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
        />
      )}

      <FAB
        icon="account-plus-outline"
        label="Novo cliente"
        onPress={openNew}
        color={theme.colors.onPrimary}
        style={[
          styles.fab,
          { backgroundColor: theme.colors.primary, bottom: insets.bottom + spacing.margem },
        ]}
      />
    </View>
  );
}

function Message({
  title,
  text,
  action,
}: {
  title?: string;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.message}>
      {title ? (
        <Text variant="headlineSmall" style={{ color: theme.colors.primary }}>
          {title}
        </Text>
      ) : null}
      <Text
        variant="bodyLarge"
        style={[styles.messageText, { color: theme.colors.onSurfaceVariant }]}
      >
        {text}
      </Text>
      {action ? (
        <Button mode="outlined" onPress={action.onPress}>
          {action.label}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchWrap: {
    paddingHorizontal: spacing.margem,
    paddingBottom: spacing.gap,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  search: { borderRadius: radii.campo, borderWidth: 1, elevation: 0 },
  searchInput: { fontSize: 17 },
  list: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  item: { minHeight: 64, paddingHorizontal: spacing.xs },
  itemTitle: { fontSize: 17, fontWeight: '700' },
  message: {
    paddingHorizontal: spacing.folha,
    paddingTop: spacing.secao,
    gap: spacing.gap,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  messageText: { fontWeight: '600', lineHeight: 25 },
  fab: { position: 'absolute', right: spacing.margem, borderRadius: radii.botao },
});
