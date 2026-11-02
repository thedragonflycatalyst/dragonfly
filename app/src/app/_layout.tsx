import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/ui';
import { ViewingBanner } from '@/features/team';
import { AppProvider, useApp } from '@/lib/app-state';
import { F, usePalette } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const p = usePalette();
  const { ready, viewing } = useApp();
  const viewingKey = viewing?.trainer_id ?? 'me';
  const [fontsLoaded] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });

  useEffect(() => { SystemUI.setBackgroundColorAsync(p.bg).catch(() => {}); }, [p.bg]);
  useEffect(() => { if (fontsLoaded && ready) SplashScreen.hideAsync().catch(() => {}); }, [fontsLoaded, ready]);

  if (!fontsLoaded || !ready) return null;
  const header = {
    headerStyle: { backgroundColor: p.bg }, headerTintColor: p.ink, headerShadowVisible: false,
    headerTitleStyle: { fontFamily: F.displayBold, color: p.ink }, contentStyle: { backgroundColor: p.bg },
  };
  return (
    <>
      <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
      <ViewingBanner />
      <Stack key={viewingKey} screenOptions={{ ...header, headerShown: false }}>
        <Stack.Screen name="account" options={{ headerShown: true, title: 'Account' }} />
        {['clients/new', 'clients/[id]/index', 'clients/[id]/edit', 'clients/[id]/[section]', 'groups/[id]', 'forms/[rid]', 'forms/build', 'me/[section]', 'workouts/[id]', 'programs/[id]', 'session', 'workout/[aid]', 'clients/[id]/workouts', 'nutrition/[id]', 'clients/[id]/nutrition', 'me/nutrition', 'me/food', 'team', 'settings', 'support', 'exercises', 'soon/[key]', 'checkins/index', 'checkins/[id]', 'programs/index'].map((name) => (
          <Stack.Screen key={name} name={name} options={{ headerShown: true, title: '' }} />
        ))}
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
