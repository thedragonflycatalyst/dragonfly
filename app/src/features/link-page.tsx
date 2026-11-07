// The frame for pages opened from a link in a text or chat (no sign-in): centered card on the ambient background.
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ambient } from '@/components/ambient';
import { Card } from '@/components/ui';
import { usePalette } from '@/lib/theme';

export function LinkPage({ title, children }: { title: string; children: ReactNode }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ headerShown: false, title }} />
      <Ambient />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 40, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <Card style={{ width: '100%', maxWidth: 480, gap: 12 }}>{children}</Card>
      </ScrollView>
    </View>
  );
}
