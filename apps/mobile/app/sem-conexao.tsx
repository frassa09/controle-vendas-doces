import { isCoreError } from '@cvd/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useSession } from '../src/session/SessionProvider';
import { spacing } from '../src/theme/theme';
import { FormScreen } from '../src/ui/FormScreen';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { ScreenHeader } from '../src/ui/ScreenHeader';

/** Entrou, mas não deu para carregar a loja (sem internet ou servidor fora do ar). */
export default function UnavailableScreen() {
  const session = useSession();
  const [retrying, setRetrying] = useState(false);
  const { state } = session;
  const message =
    state.status === 'unavailable' && isCoreError(state.error) && state.error.code !== 'UNEXPECTED'
      ? state.error.message
      : 'Não deu para carregar sua loja agora. Confira a internet e tente de novo.';

  return (
    <FormScreen>
      <ScreenHeader title="Sem conexão" lead={message} />
      <View style={styles.actions}>
        <PrimaryButton
          loading={retrying}
          onPress={async () => {
            setRetrying(true);
            await session.reload();
            setRetrying(false);
          }}
        >
          Tentar de novo
        </PrimaryButton>
        <Button mode="text" labelStyle={styles.link} onPress={() => session.signOut()}>
          Sair
        </Button>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.gap },
  link: { fontSize: 16, marginVertical: 14 },
});
