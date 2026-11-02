import { Redirect, Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Diary } from '@/features/diary';
import { useApp } from '@/lib/app-state';
import { MAX_W, usePalette } from '@/lib/theme';

/** Client: their food diary */
export default function MyFood() {
  const p = usePalette();
  const app = useApp();
  const c = app.membership;
  if (!c) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Food diary' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W }}><Diary client={c} imperial={app.units === 'imperial'} asClient /></View>
      </ScrollView>
    </View>
  );
}
