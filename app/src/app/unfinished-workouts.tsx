import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/shell';
import { Button, Card, Empty, Txt } from '@/components/ui';
import { ask } from '@/lib/ask';
import {
  discoverWorkoutDrafts, discardWorkoutDraft, draftProgress, routeForWorkoutDraft,
} from '@/lib/draft-integrity';
import { storage } from '@/lib/storage';
import type { Draft } from '@/lib/session';
import { R, usePalette } from '@/lib/theme';

/** Local-only saved workouts. No server request is made to list drafts. */
export default function UnfinishedWorkouts() {
  const p = usePalette();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState('');
  const refresh = useCallback(() => {
    try {
      setDrafts(discoverWorkoutDrafts(storage));
      setError('');
    } catch {
      setError('Could not read saved workouts on this device.');
    }
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const resume = (draft: Draft) => {
    const params = routeForWorkoutDraft(draft);
    if (!params) return;
    router.push({ pathname: '/session', params });
  };
  const discard = (draft: Draft) => ask(
    `Discard “${draft.title}”?`,
    'The unfinished progress, timers, and notes stored on this device will be deleted. Completed workout history is unaffected.',
    [
      { text: 'Keep workout', style: 'cancel' },
      { text: 'Discard draft', style: 'destructive', onPress: () => {
        try { discardWorkoutDraft(storage, draft.key); refresh(); }
        catch { setError('Unable to discard this draft. Try again.'); }
      } },
    ],
  );
  return (
    <Screen title="Unfinished workouts" kicker="Workout recovery">
      <Txt v="small">Saved on this device. Resume any workout without losing progress in the others.</Txt>
      {error ? <Txt v="small" color={p.focus}>{error}</Txt> : null}
      {!drafts.length ? (
        <Empty emoji="🏋️" title="No unfinished workouts"
          body="Workouts you leave before saving will appear here."
          action={<Button title="Back to training" onPress={() => router.back()} />} />
      ) : (
        <View style={{ gap: 12 }}>
          {drafts.map((draft) => {
            const progress = draftProgress(draft);
            const canResume = routeForWorkoutDraft(draft) !== null;
            const percent = progress.total ? Math.round(progress.completed / progress.total * 100) : 0;
            return (
              <Card key={draft.key} style={{ gap: 10 }}>
                <View style={{ gap: 3 }}>
                  <Txt v="h3" numberOfLines={2}>{draft.title}</Txt>
                  <Txt v="small">
                    {progress.completed} of {progress.total} sets completed
                    {progress.intervals ? ` · ${progress.intervals} Lapis intervals` : ''}
                  </Txt>
                  <Txt v="small">
                    Started {new Date(draft.started).toLocaleDateString()}
                    {progress.inProgress ? ' · Timers will be reconciled when resumed' : ''}
                  </Txt>
                </View>
                {progress.total > 0 ? (
                  <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}
                    style={{ height: 7, borderRadius: R.pill, overflow: 'hidden', backgroundColor: p.soft }}>
                    <View style={{ width: `${percent}%`, height: '100%', backgroundColor: p.focus }} />
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Button title="Resume workout" icon="play_arrow" disabled={!canResume}
                    onPress={() => resume(draft)} />
                  <Button kind="ghost" title="Discard" icon="delete_outline"
                    onPress={() => discard(draft)} />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
