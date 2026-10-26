import { isCoreError, type StoreInvite } from '@cvd/core';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Button, Divider, List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../src/core';
import { useSession } from '../src/session/SessionProvider';
import { radii, spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { BackHeader } from '../src/ui/BackHeader';
import { FormError } from '../src/ui/FormError';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { useFocusQuery } from '../src/ui/useFocusQuery';

const fallbackMessage = 'Algo deu errado. Tente de novo.';

type InviteState =
  | { status: 'loading' }
  | { status: 'loaded'; invite: StoreInvite | null }
  | { status: 'failed'; message: string };

function messageOf(error: unknown): string {
  return isCoreError(error) ? error.message : fallbackMessage;
}

/** Configurações da loja. Por enquanto: convidar a pessoa que vende junto. */
export default function SettingsScreen() {
  const session = useSession();
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Relido sempre que a tela ganha foco: o código some quando a pessoa o usa.
  const query = useFocusQuery(useCallback(() => core.store.getOpenInvite(), []));
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = useRef(false);

  const inviteState: InviteState =
    query.status === 'ready'
      ? { status: 'loaded', invite: query.data }
      : query.status === 'error'
        ? { status: 'failed', message: messageOf(query.error) }
        : { status: 'loading' };

  const retry = () => {
    void query.reload();
  };

  if (session.state.status !== 'ready') return null;
  const { store } = session.state;

  const generate = async () => {
    if (busy.current) return;
    busy.current = true;
    setGenerating(true);
    setActionError(null);
    try {
      await core.store.createInvite();
      // Relê em vez de usar a resposta: a tela mostra sempre o código disponível.
      await query.reload();
    } catch (error) {
      setActionError(messageOf(error));
    } finally {
      busy.current = false;
      setGenerating(false);
    }
  };

  const share = async (invite: StoreInvite) => {
    setActionError(null);
    try {
      await Share.share({
        message: `Vem vender comigo na ${store.name}! Instale o app, crie sua conta e, em "Entrar com código de convite", digite: ${invite.code}`,
      });
    } catch {
      setActionError('Não deu para abrir o compartilhamento. Dite o código para a pessoa.');
    }
  };

  const invite = inviteState.status === 'loaded' ? inviteState.invite : null;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <BackHeader title="Configurações" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.fim }]}
      >
        <View
          style={[
            styles.menuCard,
            {
              backgroundColor: theme.colors.elevation.level1,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <List.Item
            title="Aparência da página"
            description="Cor, boas-vindas e logo que o cliente vê"
            onPress={() => {
              router.push('/aparencia');
            }}
            left={(props) => <List.Icon {...props} icon="palette-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            titleStyle={styles.menuTitle}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
            style={styles.menuItem}
          />
          <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
          <List.Item
            title="Recompensas"
            description={`Troca por produto grátis: ${String(store.redeemCost)} pontos`}
            onPress={() => {
              router.push('/recompensas');
            }}
            left={(props) => <List.Icon {...props} icon="gift-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            titleStyle={styles.menuTitle}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
            style={styles.menuItem}
          />
          <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
          <List.Item
            title="Texto da cobrança"
            description="A mensagem que vai no WhatsApp"
            onPress={() => {
              router.push('/texto-cobranca');
            }}
            left={(props) => <List.Icon {...props} icon="message-text-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            titleStyle={styles.menuTitle}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
            style={styles.menuItem}
          />
        </View>

        <Text
          variant="headlineSmall"
          accessibilityRole="header"
          style={[styles.invite, { color: theme.colors.primary }]}
        >
          Convidar quem vende com você
        </Text>
        <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
          A pessoa cria a conta dela no app e digita o código. Ela vai ver e mexer em tudo da loja,
          igual a você. Cada código serve uma vez só.
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
          {inviteState.status === 'loading' ? (
            <ActivityIndicator accessibilityLabel="Carregando o código" style={styles.loading} />
          ) : inviteState.status === 'failed' ? (
            <View style={styles.cardBody}>
              <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
                {inviteState.message}
              </Text>
              <Button mode="text" labelStyle={styles.link} onPress={retry}>
                Tentar de novo
              </Button>
            </View>
          ) : invite ? (
            <View style={styles.cardBody}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                Código de convite
              </Text>
              <Text
                selectable
                accessibilityLabel={`Código ${invite.code.split('').join(' ')}`}
                style={[styles.code, { color: theme.colors.onSurface }]}
              >
                {invite.code}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Ainda não foi usado.
              </Text>
            </View>
          ) : (
            <View style={styles.cardBody}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                Nenhum código disponível. Gere um quando a pessoa estiver pronta para entrar.
              </Text>
            </View>
          )}
        </View>

        <FormError message={actionError} />

        {inviteState.status === 'loaded' ? (
          invite ? (
            <View style={styles.actions}>
              <PrimaryButton icon="share-variant" onPress={() => void share(invite)}>
                Compartilhar código
              </PrimaryButton>
              <Button
                mode="text"
                labelStyle={styles.link}
                loading={generating}
                disabled={generating}
                onPress={() => void generate()}
              >
                Gerar outro código
              </Button>
              <Text
                variant="bodyMedium"
                style={[styles.note, { color: theme.colors.onSurfaceVariant }]}
              >
                Ao gerar outro, este deixa de valer.
              </Text>
            </View>
          ) : (
            <PrimaryButton loading={generating} onPress={() => void generate()}>
              Gerar código de convite
            </PrimaryButton>
          )
        ) : null}
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
  menuCard: { borderRadius: radii.cartao, borderWidth: 1.5, overflow: 'hidden' },
  menuItem: { minHeight: 64 },
  menuTitle: { fontSize: 17, fontWeight: '800' },
  invite: { marginTop: spacing.secao },
  lead: { marginTop: spacing.gap, fontWeight: '600', lineHeight: 25 },
  card: {
    marginTop: spacing.secao,
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    minHeight: 136,
    justifyContent: 'center',
  },
  cardBody: { padding: spacing.folha, gap: spacing.sm, alignItems: 'center' },
  loading: { margin: spacing.folha },
  code: {
    fontFamily: 'Nunito',
    fontWeight: '800',
    fontSize: 34,
    lineHeight: 44,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  actions: { gap: spacing.xs },
  note: { textAlign: 'center' },
  link: { fontSize: 16, marginVertical: 14 },
});
