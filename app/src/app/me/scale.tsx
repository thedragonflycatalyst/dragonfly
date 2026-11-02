import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { ScaleView } from '@/features/scale';
import { useApp } from '@/lib/app-state';
import { MAX_W, usePalette } from '@/lib/theme';

/** Client's Scale */
export default function MyScale() {
  const p = usePalette();
  const app = useApp();
  if (!app.user) return null;
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Scale' }} />
      <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W }}>
          <ScaleView userId={app.user.id} defaults={{ height_cm: app.membership?.height_cm, sex: app.membership?.sex }} />
        </View>
      </ScrollView>
    </View>
  );
}
