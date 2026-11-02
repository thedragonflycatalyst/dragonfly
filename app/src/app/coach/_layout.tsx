import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useWide } from '@/components/shell';
import { Icon } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { COACH_TABS } from '@/lib/features';
import { F, usePalette } from '@/lib/theme';

const ROUTE: Record<string, string> = { home: 'index', clients: 'clients', chat: 'chat', workouts: 'workouts', scale: 'scale' };

/** Trainer side: Home, Clients, Chat, Workouts and Scale along the bottom; everything else in the menu sidebar */
export default function CoachLayout() {
  const p = usePalette();
  const wide = useWide();
  const { user, trainer } = useApp();
  if (!user) return <Redirect href="/sign-in" />;
  if (!trainer) return <Redirect href="/" />;
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: p.focus, tabBarInactiveTintColor: p.muted,
      tabBarStyle: wide ? { display: 'none' } : { backgroundColor: p.surface, borderTopColor: p.line, height: 64, paddingTop: 6 },
      tabBarLabelStyle: { fontFamily: F.bodyBold, fontSize: 11.5 },
      sceneStyle: { backgroundColor: p.bg },
    }}>
      {COACH_TABS.map((t) => (
        <Tabs.Screen key={t.key} name={ROUTE[t.key]} options={{ title: t.title, tabBarIcon: ({ color }) => <Icon name={t.icon} size={24} color={typeof color === 'string' ? color : undefined} /> }} />
      ))}
      <Tabs.Screen name="nutrition" options={{ href: null, title: 'Nutrition' }} />
    </Tabs>
  );
}
