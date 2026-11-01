import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { isSection, SECTIONS } from '@/features/common';
import { SectionView } from '@/features/sections';
import { useApp } from '@/lib/app-state';

/** A client's own progress section (/me/measurements, /me/photos, …). Trainer-only sections are not reachable. */
export default function MySection() {
  const app = useApp();
  const { section } = useLocalSearchParams<{ section: string }>();
  const c = app.membership;
  if (!app.user || !c || c.status !== 'active' || !isSection(section) || 'coachOnly' in SECTIONS[section]) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={{ title: SECTIONS[section].title }} />
      <SectionView section={section} client={c} role="client" units={app.units} me={app.user.id} />
    </>
  );
}
