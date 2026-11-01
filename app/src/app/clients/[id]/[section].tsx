import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Empty } from '@/components/ui';
import { isSection, SECTIONS, useClientRecord } from '@/features/common';
import { SectionView } from '@/features/sections';
import { useApp } from '@/lib/app-state';
import { usePalette } from '@/lib/theme';

/** A section of a client's profile, trainer side (/clients/{id}/measurements, /photos, …). */
export default function ClientSection() {
  const p = usePalette();
  const app = useApp();
  const { id, section } = useLocalSearchParams<{ id: string; section: string }>();
  const { client } = useClientRecord(id);
  if (!isSection(section)) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔎" title="Not found" /></View>;
  if (client === undefined) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!client || !app.user) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔎" title="Client not found" /></View>;
  return (
    <>
      <Stack.Screen options={{ title: `${client.first_name}: ${SECTIONS[section].title}` }} />
      <SectionView section={section} client={client} role="coach" units={app.units} me={app.user.id} />
    </>
  );
}
