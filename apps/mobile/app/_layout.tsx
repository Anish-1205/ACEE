import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors } from '@acee/shared';
import { AppProviders, useAuth } from '@/lib/auth';

void SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { ready } = useAuth();
  const { t } = useTranslation();
  useEffect(() => { if (ready) void SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;
  const header = { headerStyle: { backgroundColor: colors.navy }, headerTintColor: colors.white, headerTitleStyle: { fontWeight: '700' as const } };
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: t('navigation:login') }} />
      <Stack.Screen name="register" options={{ title: t('navigation:register') }} />
      <Stack.Screen name="forgot-password" options={{ title: t('authentication:forgotTitle') }} />
      <Stack.Screen name="eligibility" options={{ title: t('navigation:eligibility') }} />
      <Stack.Screen name="application" options={{ title: t('navigation:application') }} />
      <Stack.Screen name="notifications" options={{ title: t('navigation:notifications') }} />
      <Stack.Screen name="settings" options={{ title: t('navigation:settings') }} />
      <Stack.Screen name="profile" options={{ title: t('navigation:profile') }} />
      <Stack.Screen name="legal/[key]" options={{ title: '' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProviders>
        <StatusBar style="light" />
        <RootStack />
      </AppProviders>
    </SafeAreaProvider>
  );
}
