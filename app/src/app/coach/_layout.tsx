import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { AndroidSymbol } from 'expo-symbols';
import { Icon } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { F, usePalette } from '@/lib/theme';

const TABS: [name: string, title: string, icon: AndroidSymbol][] = [
  ['index', 'Hub', 'home'], ['clients', 'Clients', 'group'], ['workouts', 'Workouts', 'fitness_center'],
  ['nutrition', 'Nutrition', 'restaurant'], ['scale', 'Scale', 'monitor_weight'], ['menu', 'Menu', 'menu'],
];

/** Trainer side: bottom tabs (one tab is built per chunk). */
export default function CoachLayout() {
  const p = usePalette();
  const { user, trainer } = useApp();
  if (!user) return <Redirect href="/sign-in" />;
  if (!trainer) return <Redirect href="/" />;
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: p.focus, tabBarInactiveTintColor: p.muted,
      tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.line },
      tabBarLabelStyle: { fontFamily: F.bodyBold, fontSize: 12 },
      sceneStyle: { backgroundColor: p.bg },
    }}>
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color }) => <Icon name={icon} size={24} color={typeof color === "string" ? color : undefined} /> }} />
      ))}
    </Tabs>
  );
}
