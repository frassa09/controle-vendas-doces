import { COLLECTION_VARIABLES, type CollectionTemplate } from '@cvd/core';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';
import { core } from '../src/core';
import { spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { BackHeader } from '../src/ui/BackHeader';
import { FormError } from '../src/ui/FormError';
import { FormField } from '../src/ui/FormField';
import { FormScreen } from '../src/ui/FormScreen';
import { LoadingState } from '../src/ui/LoadingState';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { useCoreForm } from '../src/ui/useCoreForm';
import { useFocusQuery } from '../src/ui/useFocusQuery';

const variableHelp: Record<(typeof COLLECTION_VARIABLES)[number], string> = {
  nome: 'nome do cliente',
  itens: 'o que ficou em aberto, com as datas',
  total: 'quanto ele deve',
  pix: 'Pix copia-e-cola com o valor',
  link: 'link da página do cliente',
};

/** Editor do texto-modelo da mensagem de cobrança da loja. */
export default function CollectionTemplateScreen() {
  const load = useCallback(() => core.collections.getTemplate(), []);
  // Lê uma vez só: voltar ao foco não pode apagar o que já foi digitado.
  const query = useFocusQuery(load, { once: true });

  if (!query.data) return <LoadingState query={query} />;
  return <TemplateForm initial={query.data} />;
}

function TemplateForm({ initial }: { initial: CollectionTemplate }) {
  const router = useRouter();
  const theme = useAppTheme();
  const form = useCoreForm<'template'>();
  const [text, setText] = useState(initial.template);

  const save = () =>
    form.submit(async () => {
      await core.collections.setTemplate(text);
      router.back();
    });

  const restore = () =>
    form.submit(async () => {
      const restored = await core.collections.setTemplate(null);
      setText(restored.template);
    });

  return (
    <FormScreen header={<BackHeader title="Texto da cobrança" />}>
      <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
        Este é o texto que vai no WhatsApp. Toque numa palavra abaixo para colocá-la no final do
        texto; na hora de cobrar, cada uma vira o dado do cliente.
      </Text>

      <FormField
        label="Mensagem"
        value={text}
        onChangeText={(value) => {
          setText(value);
          form.clearFieldError('template');
        }}
        error={form.fieldErrors.template}
        multiline
        numberOfLines={12}
        autoCapitalize="sentences"
        style={styles.editor}
      />

      <View style={styles.chips}>
        {COLLECTION_VARIABLES.map((name) => (
          <Chip
            key={name}
            compact={false}
            accessibilityLabel={`Inserir ${name}: ${variableHelp[name]}`}
            onPress={() => {
              setText((current) => `${current}{${name}}`);
            }}
            style={styles.chip}
            textStyle={styles.chipText}
          >
            {`{${name}}`}
          </Chip>
        ))}
      </View>
      <Text variant="bodyMedium" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
        {COLLECTION_VARIABLES.map((name) => `{${name}} ${variableHelp[name]}`).join(' · ')}
      </Text>

      <FormError message={form.formError} />

      <PrimaryButton loading={form.submitting} onPress={() => void save()}>
        Salvar texto
      </PrimaryButton>
      <Button
        mode="text"
        disabled={form.submitting}
        labelStyle={styles.link}
        onPress={() => void restore()}
      >
        Voltar ao texto padrão
      </Button>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontWeight: '600', lineHeight: 25, marginBottom: spacing.margem },
  editor: { minHeight: 280, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.gap, marginBottom: spacing.gap },
  chip: { minHeight: 44, justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '700' },
  note: { marginBottom: spacing.margem, lineHeight: 22 },
  link: { fontSize: 16, marginVertical: 14 },
});
