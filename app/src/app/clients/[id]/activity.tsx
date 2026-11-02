import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Empty } from '@/components/ui';
import { useClientRecord } from '@/features/common';
import { HealthView } from '@/features/health-view';
import { MAX_W, usePalette } from '@/lib/theme';

/** A client's steps, sleep, heart rate and workouts from their connected apps */
export default function ClientActivity() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client } = useClientRecord(id);
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: client ? `${client.first_name}’s activity` : 'Activity' }} />
      <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W }}>
          {!client ? <ActivityIndicator color={p.ink} /> : !client.user_id
            ? <Empty emoji="⌚" title="Not signed up yet" body={`Once ${client.first_name} signs in and connects their apps, their steps, sleep and workouts show here.`} />
            : <HealthView userId={client.user_id} name={client.first_name} />}
        </View>
      </ScrollView>
    </View>
  );
}
