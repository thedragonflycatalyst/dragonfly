import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Txt } from '@/components/ui';
import { sb } from '@/lib/supabase';
import { fmtSeconds } from '@/lib/workouts';
import { usePalette } from '@/lib/theme';
import { lapisTimerSeconds, timersFromSyncDoc, type LapisTimer } from './library';

/** A read-only picker. Selecting saves a snapshot into the Coach workout;
 * later changes or deletion of a Lapis timer won't break assigned workouts.
 */
export function LapisTimerPicker({
  visible, onClose, onPick, userId,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (timer: LapisTimer) => void;
  userId?: string | null;
}) {
  const p = usePalette();
  const [timers, setTimers] = useState<LapisTimer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true); setError(null); setTimers([]);
    if (!userId) {
      setError('Sign in to your Dragonfly account to access your Lapis timers.');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { data, error: err } = await sb.from('lapis_sync')
          .select('doc').eq('user_id', userId).maybeSingle();
        if (!active) return;
        if (err) setError('Could not load Lapis timers. Check your connection and try again.');
        else setTimers(timersFromSyncDoc(data?.doc));
      } catch {
        if (active) setError('Could not load Lapis timers. Check your connection and try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [visible, userId, reload]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Saved Lapis timers">
      <View style={{ gap: 12 }}>
        <Txt v="small" color={p.muted}>Choose a timer from your Lapis account. Coach saves a copy of its configuration with this workout.</Txt>
        {loading ? <ActivityIndicator accessibilityLabel="Loading Lapis timers" color={p.focus} /> : null}
        {!loading && error ? <Txt color={p.danger}>{error}</Txt> : null}
        {!loading && !error && !timers.length
          ? <Txt>No saved timers found. Create and sync a timer in Lapis first.</Txt>
          : null}
        {!loading && !error && timers.map((t) => (
          <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Select ${t.name}`}
            onPress={() => { onPick(t); onClose(); }}
            style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.line, backgroundColor: p.surface, gap: 4 }}>
            <Txt v="bold">{t.name}</Txt>
            <Txt v="small" color={p.muted}>
              {t.rounds} rounds × {t.cycles} cycles · {fmtSeconds(t.work)} work / {fmtSeconds(t.rest)} rest · {fmtSeconds(lapisTimerSeconds(t))} total
            </Txt>
          </Pressable>
        ))}
        <Button kind="ghost" title="Refresh timers" icon="refresh" onPress={() => setReload((n) => n + 1)} />
      </View>
    </Sheet>
  );
}
