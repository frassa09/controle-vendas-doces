import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Divider, List, Menu, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../src/session/SessionProvider';
import { radii, spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';

/** Tela inicial da loja. As áreas de venda, clientes e cobrança chegam aqui depois. */
export default function StoreHomeScreen() {
  const session = useSession();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  if (session.state.status !== 'ready') return null;
  const { store, member } = session.state;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header
        style={{ backgroundColor: theme.colors.background }}
        statusBarHeight={insets.top}
      >
        <Appbar.Content title="" />
        <Menu
          visible={menuOpen}
          onDismiss={() => {
            setMenuOpen(false);
          }}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              accessibilityLabel="Mais opções"
              onPress={() => {
                setMenuOpen(true);
              }}
            />
          }
        >
          <Menu.Item title={member.email} disabled />
          <Divider />
          <Menu.Item
            leadingIcon="logout"
            title="Sair"
            onPress={() => {
              setMenuOpen(false);
              void session.signOut();
            }}
          />
        </Menu>
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.fim }]}
      >
        <Text
          variant="displaySmall"
          accessibilityRole="header"
          style={[styles.name, { color: theme.colors.primary }]}
        >
          {store.name}
        </Text>
        <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
          Sua loja está pronta.
        </Text>

        <View
          style={[
            styles.details,
            {
              backgroundColor: theme.colors.elevation.level1,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <List.Item
            title="Cardápio"
            description="Produtos e combos"
            onPress={() => {
              router.push('/catalogo');
            }}
            left={(props) => <List.Icon {...props} icon="cupcake" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            titleStyle={styles.entryTitle}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
            style={styles.entry}
            accessibilityRole="button"
          />
        </View>

        <View
          style={[
            styles.details,
            {
              backgroundColor: theme.colors.elevation.level1,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <List.Item
            title="Chave Pix"
            description={store.pixKey}
            left={(props) => <List.Icon {...props} icon="key-outline" />}
            titleStyle={styles.itemTitle}
            descriptionStyle={[styles.itemValue, { color: theme.colors.onSurface }]}
            descriptionNumberOfLines={2}
          />
          <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
          <List.Item
            title="Cidade"
            description={store.city}
            left={(props) => <List.Icon {...props} icon="map-marker-outline" />}
            titleStyle={styles.itemTitle}
            descriptionStyle={[styles.itemValue, { color: theme.colors.onSurface }]}
          />
        </View>
      </ScrollView>
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
  name: { lineHeight: 48 },
  lead: { marginTop: spacing.gap, fontWeight: '600' },
  details: {
    marginTop: spacing.secao,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  itemTitle: { fontSize: 14, fontWeight: '700' },
  entry: { minHeight: 64, justifyContent: 'center' },
  entryTitle: { fontSize: 17, fontWeight: '700' },
  itemValue: { fontSize: 17, marginTop: 2 },
});
