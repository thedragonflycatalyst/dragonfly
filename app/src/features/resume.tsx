import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Row } from '@/components/bits';
import { Card } from '@/components/ui';
import { discoverWorkoutDrafts } from '@/lib/draft-integrity';
import { storage } from '@/lib/storage';
import { usePalette } from '@/lib/theme';

/** Opens the full list when one or more workouts are unfinished. */
export function ResumeBanner() {
  const p = usePalette();
  const [count, setCount] = useState(0);
  useFocusEffect(useCallback(() => {
    try { setCount(discoverWorkoutDrafts(storage).length); }
    catch { setCount(0); }
  }, []));
  if (!count) return null;
  return (
    <Card style={{ padding: 0, borderWidth: 1.5, borderColor: p.focus }}>
      <Row icon="play_arrow" title={count === 1 ? '1 unfinished workout' : `${count} unfinished workouts`}
        sub="Resume where you left off, or manage saved sessions" last
        onPress={() => router.push('/unfinished-workouts')} />
    </Card>
  );
}
