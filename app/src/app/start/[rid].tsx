// Opened from a workout reminder (text, email or phone alert): starts that routine
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Empty } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

export default function StartRoutine() {
  const p = usePalette();
  const app = useApp();
  const { rid } = useLocalSearchParams<{ rid: string }>();
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!app.user || !rid) return;
    sb.rpc('coach_start_routine', { p_routine: rid }).then(({ data, error }) => {
      if (error || !data) return setFailed(/not_your_routine/.test(error?.message ?? '') ? 'This workout isn’t on your list any more.' : errText(error));
      router.replace({ pathname: '/session', params: { aid: data as string } });
    });
  }, [app.user, rid]);
  if (!app.ready) return null;
  if (!app.user) return <Redirect href="/sign-in" />;
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Stack.Screen options={{ title: 'Starting your workout' }} />
      {failed ? <Empty emoji="🏋️" title="Couldn’t start it" body={failed} action={<Button title="My workouts" onPress={() => router.replace('/me')} />} />
        : <ActivityIndicator color={p.ink} />}
    </View>
  );
}
