// The library exercises you've hidden from your lists, and a way to bring each one back.
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Txt, useToast } from '@/components/ui';
import { ExerciseThumb } from '@/features/exercises';
import { useHidden } from '@/features/library-extras';
import { Page } from '@/features/settings-page';
import { byRef } from '@/lib/library';
import { errText } from '@/lib/model';

export default function HiddenExercises() {
  const toast = useToast();
  const [hidden, toggle] = useHidden();
  const list = [...hidden].map((ref) => ({ ref, e: byRef(ref) })).sort((a, b) => (a.e?.name ?? a.ref).localeCompare(b.e?.name ?? b.ref));
  return (
    <Page title="Hidden exercises">
      <Stack.Screen options={{ title: 'Hidden exercises' }} />
      <Txt v="small" style={{ marginBottom: 12 }}>These don’t show up in your exercise search or swap options. Hide one from its info card; bring it back here.</Txt>
      {list.length === 0 && <Txt>Nothing hidden.</Txt>}
      {list.length > 0 && <Card style={{ padding: 0 }}>
        {list.map(({ ref, e }, i) => (
          <View key={ref} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(127,127,127,.2)' }}>
            <ExerciseThumb img={e?.images[0]} video={e?.video} size={48} />
            <Txt v="bold" style={{ flex: 1 }}>{e?.name ?? 'Removed exercise'}</Txt>
            <Button small kind="ghost" title="Show again" onPress={() => toggle(ref, false).then(() => toast(`${e?.name ?? 'It'} is back in your lists`), (x: unknown) => toast(errText(x), false))} />
          </View>
        ))}
      </Card>}
    </Page>
  );
}
