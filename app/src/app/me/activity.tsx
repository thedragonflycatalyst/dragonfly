import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { HealthView } from '@/features/health-view';
import { useApp } from '@/lib/app-state';
import { MAX_W, usePalette } from '@/lib/theme';

/** Your steps, sleep, heart rate and workouts from connected apps */
export default function MyActivity() {
  const p = usePalette();
  const app = useApp();
  if (!app.user) return null;
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Activity & sleep' }} />
      <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W }}><HealthView userId={app.user.id} own /></View>
      </ScrollView>
    </View>
  );
}
