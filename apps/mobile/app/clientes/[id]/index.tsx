import { formatWhatsApp } from '@cvd/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Divider, List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../../../src/core';
import { radii, spacing } from '../../../src/theme/theme';
import { useAppTheme } from '../../../src/theme/ThemeProvider';
import { BackHeader } from '../../../src/ui/BackHeader';
import { LoadingState } from '../../../src/ui/LoadingState';
import { useFocusQuery } from '../../../src/ui/useFocusQuery';

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Perfil básico do cliente: contato, PIN e consentimento. */
export default function CustomerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const load = useCallback(() => core.customers.getCustomer(id), [id]);
  const query = useFocusQuery(load);

  if (!query.data) return <LoadingState query={query} />;
  const customer = query.data;
  const valueStyle = [styles.itemValue, { color: theme.colors.onSurface }];
  const divider = <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <BackHeader>
        <Appbar.Action
          icon="pencil-outline"
          accessibilityLabel="Editar cliente"
          onPress={() => {
            router.push({ pathname: '/clientes/[id]/editar', params: { id: customer.id } });
          }}
        />
      </BackHeader>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.fim }]}
      >
        <Text
          variant="headlineLarge"
          accessibilityRole="header"
          style={{ color: theme.colors.primary }}
        >
          {customer.name}
        </Text>
        {customer.reference ? (
          <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
            {customer.reference}
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
          <List.Item
            title="WhatsApp"
            description={formatWhatsApp(customer.whatsapp)}
            left={(props) => <List.Icon {...props} icon="whatsapp" />}
            titleStyle={styles.itemTitle}
            descriptionStyle={valueStyle}
          />
          {divider}
          <List.Item
            title="PIN"
            description={customer.pin}
            accessibilityLabel={`PIN ${customer.pin.split('').join(' ')}`}
            left={(props) => <List.Icon {...props} icon="lock-outline" />}
            titleStyle={styles.itemTitle}
            descriptionStyle={[styles.pin, { color: theme.colors.onSurface }]}
          />
          {divider}
          <List.Item
            title="Consentimento (LGPD)"
            description={
              customer.consentAt
                ? `Aceitou em ${dateFormat.format(new Date(customer.consentAt))}`
                : 'Não registrado'
            }
            left={(props) => (
              <List.Icon
                {...props}
                icon={customer.consented ? 'check-circle-outline' : 'alert-circle-outline'}
              />
            )}
            titleStyle={styles.itemTitle}
            descriptionStyle={valueStyle}
          />
          {customer.notes ? (
            <>
              {divider}
              <List.Item
                title="Observações"
                description={customer.notes}
                descriptionNumberOfLines={0}
                left={(props) => <List.Icon {...props} icon="note-text-outline" />}
                titleStyle={styles.itemTitle}
                descriptionStyle={valueStyle}
              />
            </>
          ) : null}
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
  lead: { marginTop: spacing.gap, fontWeight: '600' },
  card: {
    marginTop: spacing.secao,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  itemTitle: { fontSize: 14, fontWeight: '700' },
  itemValue: { fontSize: 17, marginTop: 2 },
  pin: {
    fontFamily: 'Caprasimo',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 6,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});
