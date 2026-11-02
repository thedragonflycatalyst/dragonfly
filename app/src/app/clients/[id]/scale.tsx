import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Empty } from '@/components/ui';
import { useClientRecord } from '@/features/common';
import { ScaleView } from '@/features/scale';
import { MAX_W, usePalette } from '@/lib/theme';

/** A client's Scale, read-only for the trainer */
export default function ClientScale() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client } = useClientRecord(id);
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: client ? `${client.first_name}’s scale` : 'Scale' }} />
      <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W }}>
          {!client ? <ActivityIndicator color={p.ink} /> : !client.user_id
            ? <Empty emoji="⚖️" title="Not signed up yet" body={`Once ${client.first_name} signs in to Dragonfly, their weigh-ins show here.`} />
            : <ScaleView userId={client.user_id} readOnly defaults={{ height_cm: client.height_cm, sex: client.sex }} />}
        </View>
      </ScrollView>
    </View>
  );
}
