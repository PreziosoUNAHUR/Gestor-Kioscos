import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfigNotice } from '@/components/layout/ConfigNotice';
import { useAppFonts } from '@/lib/fonts';
import { isSupabaseConfigured } from '@/lib/env';
import { navigationTheme, palette } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';

import '../../global.css';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const session = useAuthStore((store) => store.session);
  const initialized = useAuthStore((store) => store.initialized);
  const initialize = useAuthStore((store) => store.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const ready = (fontsLoaded || Boolean(fontError)) && initialized;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ConfigNotice />
      </SafeAreaProvider>
    );
  }

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: palette.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.bg },
            animation: 'fade',
          }}
        >
          <Stack.Protected guard={Boolean(session)} redirectTo="/login">
            <Stack.Screen name="(app)" />
          </Stack.Protected>

          <Stack.Protected guard={!session} redirectTo="/">
            <Stack.Screen name="(auth)" />
          </Stack.Protected>

          <Stack.Screen name="+not-found" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
