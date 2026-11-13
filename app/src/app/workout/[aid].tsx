import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Badge } from '@/components/shell';
import { Button, Card, Empty, Txt, useToast } from '@/components/ui';
import { ExerciseInfo, ExerciseThumb } from '@/features/exercises';
import { SessionSummary } from '@/features/session-summary';
import { ask } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { fmtShort, fmtTime, fromKey, relDay } from '@/lib/dates';
import { errText, type Assignment, type ExerciseBlock, type SetLog, type WorkoutLog } from '@/lib/model';
import { clock, DRAFT_KEY, readDraft } from '@/lib/session';
import { storage } from '@/lib/storage';
import { sb } from '@/lib/supabase';
import { weightUnit } from '@/lib/units';
import { setLine } from '@/lib/history';
import { fmtSeconds, volume } from '@/lib/workouts';
import { lapisTimerSeconds, parseLapisTimer } from '@/features/lapis/library';
import { MAX_W, usePalette } from '@/lib/theme';
import { byRef } from '@/lib/library';

const planned = (b: ExerciseBlock, i: number, unit: string) => {
  const s = b.sets[i];
  const what = b.metric === 'time' ? fmtSeconds(s.time) : b.metric === 'distance' ? s.distance : s.reps && `${s.reps} reps`;
  return [s.weight && (/^[\d.]+$/.test(s.weight) ? `${s.weight} ${unit}` : s.weight), what, s.tempo && `tempo ${s.tempo}`, s.rest != null && `rest ${fmtSeconds(s.rest)}`].filter(Boolean).join(' · ') || '—';
};

/** One scheduled workout: what's planned, Start or Skip, and the log once it's done. */
export default function AssignmentScreen() {
  const p = usePalette();
  const [info, setInfo] = useState<ExerciseBlock['ex'] | null>(null);
  const toast = useToast();
  const app = useApp();
  const { aid, done: justDone } = useLocalSearchParams<{ aid: string; done?: string }>();
  const [popup, setPopup] = useState(justDone === '1');
  const [a, setA] = useState<Assignment | null | undefined>(undefined);
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [r, l] = await Promise.all([sb.from('coach_assignments').select('*').eq('id', aid).maybeSingle(), sb.from('coach_logs').select('*').eq('assignment_id', aid).maybeSingle()]);
    setA((r.data as Assignment) ?? null); setLog((l.data as WorkoutLog) ?? null);
  }, [aid]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (a === undefined) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!a) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔎" title="Workout not found" /></View>;
  const mine = a.trainer_id === app.user?.id;
  const inProgress = readDraft((k) => storage.getItem(k))?.key === `a:${a.id}`;
  const blocks = a.snapshot.filter((b): b is ExerciseBlock => b.kind === 'exercise');

  const skip = async (skipped: boolean) => {
    setBusy(true);
    const { error } = mine
      ? await sb.from('coach_assignments').update({ status: skipped ? 'skipped' : 'scheduled' }).eq('id', a.id)
      : await sb.rpc('coach_set_assignment_skipped', { p_assignment: a.id, p_skipped: skipped });
    setBusy(false);
    if (error) toast(errText(error), false); else load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: a.title }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Txt v="kicker" color={p.focus}>{relDay(a.scheduled_on)} · {fmtShort(fromKey(a.scheduled_on))}</Txt>
            {a.status === 'done' ? <Badge text="Done" color={p.good} /> : a.status === 'skipped' ? <Badge text="Skipped" /> : null}
          </View>
          {a.trainer_note ? <Card><Txt v="smallBold" color={p.focus}>{mine ? 'Your note' : 'From your trainer'}</Txt><Txt>{a.trainer_note}</Txt></Card> : null}

          {log && (
            <Card style={{ gap: 6, borderWidth: 1.5, borderColor: p.good }}>
              <Txt v="bold">Logged {fmtShort(log.performed_at)} at {fmtTime(log.performed_at)}{log.source === 'trainer' ? ' by the trainer' : ''}</Txt>
              <Txt v="small">
                {[log.duration_seconds != null && clock(log.duration_seconds), log.rpe && `effort ${log.rpe}/10`, volume(log.entries) && `${volume(log.entries).toLocaleString()} ${log.entries[0]?.unit ?? ''} lifted`].filter(Boolean).join(' · ')}
              </Txt>
              {log.note ? <Txt>“{log.note}”</Txt> : null}
              <Button small kind="ghost" icon="chat_bubble" title={mine ? 'Cheer them on in chat' : 'Share with your trainer'} style={{ alignSelf: 'flex-start', marginTop: 4 }} onPress={async () => {
                try {
                  const other = mine ? (await sb.from('coach_clients').select('user_id').eq('id', a.client_id).maybeSingle()).data?.user_id : app.myTrainer?.user_id;
                  if (!other) return toast('They haven’t signed in to Dragonfly yet', false);
                  const { data: chat, error } = await sb.rpc('coach_chat_direct', { p_user: other });
                  if (error) throw error;
                  const summary = [log.duration_seconds != null && clock(log.duration_seconds), log.rpe && `effort ${log.rpe}/10`].filter(Boolean).join(' · ');
                  const { error: e2 } = await sb.from('coach_messages').insert({ chat_id: chat, kind: 'workout', body: null, meta: { title: a.title, assignment_id: a.id, date: log.performed_at, summary } });
                  if (e2) throw e2;
                  router.push({ pathname: '/chat/[id]', params: { id: chat as string } });
                } catch (e) { toast(errText(e), false); }
              }} />
            </Card>
          )}

          {log && <SessionSummary log={log} unit={weightUnit(app.units)} title={a.title} />}
          {log && popup && <SessionSummary popup onClose={() => setPopup(false)} log={log} unit={weightUnit(app.units)} title={a.title} />}
          {a.snapshot.filter((b) => b.kind === 'timed').map((b) => {
            if (b.kind !== 'timed') return null;
            const timer = b.timer.source?.app === 'lapis' ? parseLapisTimer(b.timer.source.snapshot) : null;
            const completed = log?.timer_results?.find((r) => r.block_id === b.id);
            return (
              <Card key={b.id} style={{ gap: 6 }}>
                <Txt v="kicker" color={p.focus}>Lapis timer</Txt>
                <Txt v="h3">{b.name}</Txt>
                <Txt v="small">{timer ? fmtSeconds(lapisTimerSeconds(timer)) : fmtSeconds(b.timer.work * b.timer.rounds)} planned</Txt>
                <Txt v="smallBold" color={completed ? p.good : p.muted}>
                  {completed ? `Completed · ${fmtSeconds(completed.actual_seconds)}` : log ? 'Not completed' : 'Not started'}
                </Txt>
              </Card>
            );
          })}
          {blocks.map((b) => {
            const done = log?.entries.find((e) => e.block_id === b.id);
            return (
              <Card key={b.id} style={{ gap: 8 }}>
                <Pressable onPress={() => setInfo(b.ex)} accessibilityRole="button" accessibilityLabel={`${b.ex.name}: how to do it, or report a problem`}
                  style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <ExerciseThumb img={b.ex.img} video={b.ex.video} size={52} ex={byRef(`${b.ex.src}:${b.ex.id}`) ?? { name: b.ex.name }} />
                  <Txt v="h3" style={{ flex: 1 }}>{b.ex.name}</Txt>
                </Pressable>
                {b.note ? <Txt v="small">{b.note}</Txt> : null}
                {log
                  ? (done?.sets.length ? <>
                      {done.swapped_from || (done.ex && done.ex.name !== b.ex.name) ? <Txt v="smallBold" color={p.focus}>Swapped to {done.ex?.name}</Txt> : null}
                      {done.sets.map((s, i) => <Txt key={i}>Set {i + 1}: {setLine(s, done.unit)}</Txt>)}
                      {b.sets.length > done.sets.length && <Txt v="small" color={p.muted}>{b.sets.length - done.sets.length} of {b.sets.length} sets not done</Txt>}
                      {done.note ? <Txt v="small" style={{ fontStyle: 'italic' }}>“{done.note}”</Txt> : null}
                    </> : <Txt v="small">Not done</Txt>)
                  : b.sets.map((_, i) => <Txt key={i}>Set {i + 1}: {planned(b, i, weightUnit(app.units))}</Txt>)}
              </Card>
            );
          })}

          {a.status !== 'done' && (
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              {a.status === 'scheduled' && <Button kind="accent" icon="play_arrow" title={inProgress ? 'Resume workout' : mine ? 'Start session' : 'Start workout'}
                onPress={() => router.push({ pathname: '/session', params: { aid: a.id } })} />}
              {a.status === 'scheduled'
                ? <Button kind="ghost" title="Skip" busy={busy} onPress={() => ask('Skip this workout?', 'You can undo this later.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Skip', onPress: () => skip(true) }])} />
                : <Button kind="ghost" title="Undo skip" busy={busy} onPress={() => skip(false)} />}
              {mine && <Button kind="danger" title="Remove from calendar" onPress={() => ask('Remove this workout?', 'It comes off your client’s calendar.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: async () => {
                  const { error } = await sb.from('coach_assignments').delete().eq('id', a.id);
                  if (error) toast(errText(error), false); else { if (inProgress) storage.removeItem(DRAFT_KEY); router.back(); }
                } }])} />}
            </View>
          )}
        </View>
      </ScrollView>
      <ExerciseInfo ex={info ? { name: info.name, ref: `${info.src}:${info.id}`, img: info.img, video: info.video } : null} onClose={() => setInfo(null)} screen="client_workout" />
    </View>
  );
}
