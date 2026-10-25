import { BRANDING_LIMITS, isCoreError, type Store } from '@cvd/core';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { core } from '../src/core';
import { useSession } from '../src/session/SessionProvider';
import { deriveStoreColors, DEFAULT_STORE_COLOR, materials } from '../src/theme/storeColors';
import { radii, spacing } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/ThemeProvider';
import { BackHeader } from '../src/ui/BackHeader';
import { FormError } from '../src/ui/FormError';
import { FormField } from '../src/ui/FormField';
import { FormScreen } from '../src/ui/FormScreen';
import { LoadingState } from '../src/ui/LoadingState';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { useCoreForm } from '../src/ui/useCoreForm';
import { useFocusQuery } from '../src/ui/useFocusQuery';

/** As cores testadas no DESIGN.md (todas passam nas travas de contraste). */
const SUGGESTED = [
  { hex: '#D6336C', name: 'Framboesa' },
  { hex: '#E8590C', name: 'Laranja' },
  { hex: '#2B8A3E', name: 'Verde' },
  { hex: '#1971C2', name: 'Azul' },
  { hex: '#7048E8', name: 'Roxo' },
  { hex: '#8B5A3C', name: 'Caramelo' },
  { hex: '#F2C94C', name: 'Amarelo' },
] as const;

/** Logo pequeno: 256 px de lado em WebP basta para a página e cabe no limite do core. */
const LOGO_SIZE = 256;

const HEX = /^#?[0-9a-fA-F]{6}$/;

/** Aparência da página do cliente: cor principal, boas-vindas e logo. */
export default function AppearanceScreen() {
  const session = useSession();
  // O logo é lido à parte (é pesado e não vem com a loja).
  const query = useFocusQuery(
    useCallback(() => core.store.getStoreLogo(), []),
    { once: true },
  );

  if (session.state.status !== 'ready') return null;
  if (query.status !== 'ready') return <LoadingState query={query} />;
  return <AppearanceForm store={session.state.store} initialLogo={query.data ?? null} />;
}

function AppearanceForm({ store, initialLogo }: { store: Store; initialLogo: string | null }) {
  const router = useRouter();
  const theme = useAppTheme();
  const session = useSession();
  const form = useCoreForm<'brandColor' | 'welcomeText'>();
  const [color, setColor] = useState(store.brandColor ?? '');
  const [welcome, setWelcome] = useState(store.welcomeText ?? '');
  const [logo, setLogo] = useState(initialLogo);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const chosen = HEX.test(color.trim()) ? `#${color.trim().replace('#', '').toUpperCase()}` : null;
  const preview = deriveStoreColors(chosen ?? DEFAULT_STORE_COLOR);
  const isSuggested = (hex: string) => (chosen ?? DEFAULT_STORE_COLOR) === hex;

  const save = () =>
    form.submit(async () => {
      const saved = await core.store.updateStoreBranding({
        brandColor: color.trim() === '' ? null : color,
        welcomeText: welcome,
      });
      session.storeUpdated(saved);
      router.back();
    });

  const changeLogo = async (next: string | null) => {
    setLogoBusy(true);
    setLogoError(null);
    try {
      await core.store.setStoreLogo(next);
      setLogo(next);
    } catch (error) {
      setLogoError(
        isCoreError(error)
          ? (Object.values(error.fieldErrors)[0] ?? error.message)
          : 'Não deu para salvar o logo. Tente de novo.',
      );
    } finally {
      setLogoBusy(false);
    }
  };

  const pickLogo = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    const asset = picked.canceled ? undefined : picked.assets[0];
    if (!asset) return;
    setLogoBusy(true);
    try {
      const image = await ImageManipulator.manipulate(asset.uri)
        .resize({ width: LOGO_SIZE, height: LOGO_SIZE })
        .renderAsync();
      const result = await image.saveAsync({
        format: SaveFormat.WEBP,
        compress: 0.85,
        base64: true,
      });
      if (!result.base64) throw new Error('sem base64');
      await changeLogo(`data:image/webp;base64,${result.base64}`);
    } catch {
      setLogoBusy(false);
      setLogoError('Não deu para usar essa imagem. Tente outra.');
    }
  };

  return (
    <FormScreen header={<BackHeader title="Aparência da página" />}>
      <Text variant="bodyLarge" style={[styles.lead, { color: theme.colors.onSurfaceVariant }]}>
        É assim que seus clientes veem o cantinho deles. Sem escolher nada, a página usa a cor
        framboesa e uma frase sobre os pontos.
      </Text>

      {/* Prévia com as cores que a página vai usar (as mesmas receitas do DESIGN.md). */}
      <View
        style={[
          styles.preview,
          { backgroundColor: preview.parede, borderColor: materials.madeira2 },
        ]}
        accessibilityLabel="Prévia da página do cliente"
      >
        <Text variant="headlineSmall" style={{ color: preview.forte }} numberOfLines={1}>
          Cantinho de Júlia
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.previewLead, { color: materials.cacau2 }]}
          numberOfLines={2}
        >
          {welcome.trim() || 'Mais 3 doces na estante e o próximo é por nossa conta.'}
        </Text>
        <View style={[styles.previewButton, { backgroundColor: preview.forte }]}>
          <Text style={styles.previewButtonText}>Pagar R$ 18,00</Text>
        </View>
      </View>

      <Text variant="titleMedium" style={styles.section} accessibilityRole="header">
        Cor principal
      </Text>
      <View style={styles.swatches} accessibilityRole="radiogroup">
        {SUGGESTED.map(({ hex, name }) => {
          const selected = isSuggested(hex);
          return (
            <Pressable
              key={hex}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={name}
              onPress={() => {
                setColor(hex === DEFAULT_STORE_COLOR ? '' : hex);
                form.clearFieldError('brandColor');
              }}
              style={[
                styles.swatch,
                {
                  backgroundColor: hex,
                  borderColor: selected ? theme.colors.onSurface : theme.colors.surface,
                },
              ]}
            />
          );
        })}
      </View>
      <FormField
        label="Outra cor (#RRGGBB)"
        value={color}
        onChangeText={(value) => {
          setColor(value);
          form.clearFieldError('brandColor');
        }}
        error={form.fieldErrors.brandColor}
        hint="Vazio usa a cor padrão. Qualquer cor fica legível na página."
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={7}
      />

      <Text variant="titleMedium" style={styles.section} accessibilityRole="header">
        Boas-vindas
      </Text>
      <FormField
        label="Texto de boas-vindas"
        value={welcome}
        onChangeText={(value) => {
          setWelcome(value);
          form.clearFieldError('welcomeText');
        }}
        error={form.fieldErrors.welcomeText}
        hint={`${String(welcome.trim().length)} de ${String(BRANDING_LIMITS.welcomeText)} letras. Aparece abaixo do nome do cliente.`}
        multiline
        autoCapitalize="sentences"
        style={styles.welcome}
      />

      <Text variant="titleMedium" style={styles.section} accessibilityRole="header">
        Logo
      </Text>
      <View style={styles.logoRow}>
        <View
          style={[
            styles.logoBox,
            { borderColor: materials.madeira2, backgroundColor: theme.colors.surface },
          ]}
        >
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} accessibilityLabel="Logo da loja" />
          ) : (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Sem logo
            </Text>
          )}
        </View>
        <View style={styles.logoActions}>
          <Button
            mode="outlined"
            icon="image-outline"
            loading={logoBusy}
            disabled={logoBusy}
            onPress={() => void pickLogo()}
            labelStyle={styles.buttonLabel}
            contentStyle={styles.buttonContent}
          >
            {logo ? 'Trocar logo' : 'Escolher logo'}
          </Button>
          {logo ? (
            <Button
              mode="text"
              disabled={logoBusy}
              onPress={() => void changeLogo(null)}
              labelStyle={styles.buttonLabel}
              contentStyle={styles.buttonContent}
            >
              Tirar logo
            </Button>
          ) : null}
        </View>
      </View>
      <Text variant="bodyMedium" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
        O logo é salvo na hora e aparece no topo da página, ao lado do nome da loja.
      </Text>
      <FormError message={logoError} />

      <FormError message={form.formError} />
      <PrimaryButton loading={form.submitting} onPress={() => void save()}>
        Salvar cor e boas-vindas
      </PrimaryButton>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontWeight: '600', lineHeight: 25, marginBottom: spacing.margem },
  preview: {
    borderRadius: radii.cartao,
    borderWidth: 1.5,
    padding: spacing.margem,
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewLead: { textAlign: 'center', fontWeight: '600' },
  previewButton: {
    marginTop: spacing.xs,
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: radii.botao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonText: { color: '#FFFFFF', fontFamily: 'Nunito', fontWeight: '800', fontSize: 16 },
  section: { marginTop: spacing.secao, marginBottom: spacing.gap },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.gap, marginBottom: spacing.md },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  welcome: { minHeight: 96, textAlignVertical: 'top' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: radii.campo,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 88, height: 88 },
  logoActions: { flex: 1, gap: spacing.xs },
  buttonLabel: { fontSize: 16 },
  buttonContent: { minHeight: 48 },
  note: { marginTop: spacing.gap, lineHeight: 22 },
});
