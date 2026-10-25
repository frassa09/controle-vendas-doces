import { isCoreError, type StoreInvite } from '@cvd/core';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { core } from '../src/core';
import { useSession } from '../src/session/SessionProvider';
import { radii, spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { FormError } from '../src/ui/FormError';
import { PrimaryButton } from '../src/ui/PrimaryButton';

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
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [inviteState, setInviteState] = useState<InviteState>({ status: 'loading' });
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = useRef(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    core.store.getOpenInvite().then(
      (invite) => {
        if (active) setInviteState({ status: 'loaded', invite });
      },
      (error: unknown) => {
        if (active) setInviteState({ status: 'failed', message: messageOf(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setInviteState({ status: 'loading' });
    setAttempt((value) => value + 1);
  };

  if (session.state.status !== 'ready') return null;
  const { store } = session.state;

  const generate = async () => {
    if (busy.current) return;
    busy.current = true;
    setGenerating(true);
    setActionError(null);
    try {
      setInviteState({ status: 'loaded', invite: await core.store.createInvite() });
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
        <Appbar.Content title="Configurações" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.fim }]}
      >
        <Text
          variant="headlineSmall"
          accessibilityRole="header"
          style={{ color: theme.colors.primary }}
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
  appbarTitle: { fontSize: 20, fontWeight: '700' },
  content: {
    paddingHorizontal: spacing.folha,
    paddingTop: spacing.gap,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
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
