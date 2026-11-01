import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Row } from '@/components/bits';
import { Card } from '@/components/ui';
import { readDraft, type Draft } from '@/lib/session';
import { storage } from '@/lib/storage';
import { usePalette } from '@/lib/theme';

/** "Finish your workout" banner when a workout was started on this device and not saved */
export function ResumeBanner() {
  const p = usePalette();
  const [d, setD] = useState<Draft | null>(null);
  useFocusEffect(useCallback(() => { setD(readDraft((k) => storage.getItem(k))); }, []));
  if (!d) return null;
  return (
    <Card style={{ padding: 0, borderWidth: 1.5, borderColor: p.focus }}>
      <Row icon="play_arrow" title={`Finish “${d.title}”`} sub="You started this workout and haven’t saved it yet" last
        onPress={() => router.push({ pathname: '/session', params: d.params })} />
    </Card>
  );
}
