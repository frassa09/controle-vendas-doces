import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../src/session/SessionProvider';
import { ThemeProvider, useAppTheme } from '../src/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        {/* A cor da loja entra aqui quando a loja puder escolher a sua. */}
        <ThemeProvider>
          <StatusBar style="dark" />
          <Routes />
        </ThemeProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

/**
 * Cada etapa do primeiro acesso só existe enquanto faz sentido: sem sessão, entrar
 * ou criar conta; com sessão e sem loja, criar a loja; com loja, a loja.
 */
function Routes() {
  const { state } = useSession();
  const theme = useAppTheme();
  const { status } = state;

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator accessibilityLabel="Carregando" size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="entrar" />
        <Stack.Screen name="criar-conta" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'noStore'}>
        <Stack.Screen name="criar-loja" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'unavailable'}>
        <Stack.Screen name="sem-conexao" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="index" />
        <Stack.Screen name="clientes/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="clientes/novo" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="clientes/[id]/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="clientes/[id]/editar" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="catalogo" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="produto" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
