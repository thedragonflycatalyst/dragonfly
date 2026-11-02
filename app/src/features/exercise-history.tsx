import { ScrollView, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/ui';
import { setLine, type ExerciseTime } from '@/lib/history';
import type { LogEntry } from '@/lib/model';
import { usePalette } from '@/lib/theme';

/** Every past time this exercise was done: the sets, and the note left that day (greyed, like a ghost) */
export function ExerciseHistory({ entry, history, onClose }: { entry: LogEntry | null; history: ExerciseTime[]; onClose: () => void }) {
  const p = usePalette();
  return (
    <Sheet visible={!!entry} onClose={onClose} title={entry?.ex?.name ?? 'History'}>
      {history.length === 0 && <Txt>No history for this exercise yet.</Txt>}
      <ScrollView style={{ maxHeight: 460 }}>
        {history.map((h, i) => (
          <View key={`${h.at}${i}`} style={{ paddingVertical: 10, gap: 3, borderBottomWidth: i === history.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
            <Txt v="bold">{new Date(h.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Txt>
            {h.sets.map((s, n) => <Txt key={n} v="small" color={p.ink}>Set {n + 1}: {setLine(s, h.unit)}</Txt>)}
            {h.note ? <Txt v="small" style={{ fontStyle: 'italic', opacity: 0.55 }}>{h.note}</Txt> : null}
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}
