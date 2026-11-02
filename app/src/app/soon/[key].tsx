import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Card, Icon, Txt } from '@/components/ui';
import { MAX_W, usePalette } from '@/lib/theme';

/** A Menu item that's on the way: what it will do */
export default function Soon() {
  const p = usePalette();
  const { key } = useLocalSearchParams<{ key: string }>();
  const f = key ? { title: key.replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase()), icon: 'schedule' as const, soon: '' } : null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
      <Stack.Screen options={{ title: f?.title ?? 'Coming soon' }} />
      <View style={{ width: '100%', maxWidth: MAX_W }}>
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          {f && <Icon name={f.icon} size={44} color={p.focus} />}
          <Txt v="h2" center>{f ? `${f.title} is on the way` : 'Coming soon'}</Txt>
          {f?.soon ? <Txt center style={{ maxWidth: 480 }}>{f.soon}</Txt> : null}
        </Card>
      </View>
    </ScrollView>
  );
}
