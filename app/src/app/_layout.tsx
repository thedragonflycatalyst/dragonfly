import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/ui';
import { SidebarDrawer, SidebarRail, useWide } from '@/components/shell';
import { AutoSync } from '@/features/auto-sync';
import { flushCrashes, installCrashReporter, noteRoute } from '@/features/crash-reporter';
import { loadLibraryExtras } from '@/features/library-extras';
import { ViewingBanner } from '@/features/team';
import { AppProvider, useApp } from '@/lib/app-state';
import { F, usePalette } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
// Release builds: scrubbed crash reports (no personal data); off switch in Settings › About
installCrashReporter();

function Shell() {
  const p = usePalette();
  const { ready, viewing, user } = useApp();
  const wide = useWide();
  const viewingKey = viewing?.trainer_id ?? 'me';
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => { SystemUI.setBackgroundColorAsync(p.bg).catch(() => {}); }, [p.bg]);
  useEffect(() => { if (fontsLoaded && ready) SplashScreen.hideAsync().catch(() => {}); }, [fontsLoaded, ready]);
  // Trainers' approved library additions and extra search names (stored online)
  useEffect(() => { if (ready && user) loadLibraryExtras().catch(() => {}); }, [ready, user]);
  const path = usePathname();
  useEffect(() => { noteRoute(path); }, [path]);
  // Crashes queued while signed out (or just before the app closed) go out once someone is signed in
  useEffect(() => { if (user) void flushCrashes(); }, [user]);

  if (!fontsLoaded || !ready) return null;
  const header = {
    headerStyle: { backgroundColor: p.bg }, headerTintColor: p.ink, headerShadowVisible: false,
    headerTitleStyle: { fontFamily: F.displayBold, color: p.ink }, contentStyle: { backgroundColor: p.bg },
  };
  return (
    <>
      <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
      <ViewingBanner />
      <AutoSync />
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: p.bg }}>
      {wide && <SidebarRail />}
      <View style={{ flex: 1 }}>
      <Stack key={viewingKey} screenOptions={{ ...header, headerShown: false }}>
        <Stack.Screen name="account" options={{ headerShown: true, title: 'Account' }} />
        {['clients/new', 'clients/[id]/index', 'clients/[id]/edit', 'clients/[id]/[section]', 'groups/[id]', 'forms/[rid]', 'forms/build', 'me/[section]', 'workouts/[id]', 'programs/[id]', 'session', 'workout/[aid]', 'clients/[id]/workouts', 'nutrition/[id]', 'clients/[id]/nutrition', 'me/nutrition', 'me/food', 'team', 'support', 'exercises', 'soon/[key]', 'checkins/index', 'checkins/[id]', 'programs/index',
          'settings/index', 'settings/coaching', 'settings/details', 'settings/branding', 'settings/notifications', 'settings/units', 'settings/rest-timer', 'feedback', 'settings/permissions', 'settings/about',
          'packages/index', 'packages/[id]', 'financials', 'habits', 'communities/index', 'communities/[id]', 'resources', 'calendar', 'events/index', 'events/[id]',
          'chat/index', 'chat/[id]', 'chat/new', 'chat/info', 'chat/broadcast', 'files', 'notifications', 'me/scale', 'me/packages', 'clients/[id]/scale', 'clients/[id]/billing', 'connections', 'me/activity', 'clients/[id]/activity', 'join-qr', 'library-review', 'settings/hidden-exercises', 'credentials'].map((name) => (
          <Stack.Screen key={name} name={name} options={{ headerShown: true, title: '' }} />
        ))}
      </Stack>
      </View>
      </View>
      {!wide && <SidebarDrawer />}
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
