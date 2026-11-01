import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { ExerciseThumb } from '@/features/exercises';
import { ask } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { dayKey } from '@/lib/dates';
import { errText, type Assignment, type Client, type ExerciseBlock, type LogEntry, type SetLog, type WorkoutBlock } from '@/lib/model';
import { clock, doneOnly, DRAFT_KEY, readDraft, restAfter, type Draft } from '@/lib/session';
import { storage } from '@/lib/storage';
import { sb } from '@/lib/supabase';
import { weightUnit } from '@/lib/units';
import { fmtSeconds, parseSeconds, setsDone, setsTotal, startLog, volume } from '@/lib/workouts';
import { F, MAX_W, R, usePalette } from '@/lib/theme';

type Source = { title: string; blocks: WorkoutBlock[]; assignment: Assignment | null; workoutId: string | null };

/** Live workout: tick off sets, adjust numbers, rest timer between sets, then save. Works for a client or for the trainer running a session. */
export default function Session() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { aid, workout } = useLocalSearchParams<{ aid?: string; workout?: string }>();
  const key = aid ? `a:${aid}` : `w:${workout}`;
  const unit = weightUnit(app.units);
  const [src, setSrc] = useState<Source | null | undefined>(undefined);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [started, setStarted] = useState(Date.now());
  const [clientId, setClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const saved = useRef(false);

  // Load the workout (or assignment) and any unfinished draft of it
  useEffect(() => {
    (async () => {
      let s: Source | null = null;
      if (aid) {
        const { data } = await sb.from('coach_assignments').select('*').eq('id', aid).maybeSingle();
        const a = data as Assignment | null;
        if (a) { s = { title: a.title, blocks: a.snapshot, assignment: a, workoutId: a.workout_id }; setClientId(a.client_id); }
      } else if (workout) {
        const { data } = await sb.from('coach_workouts').select('id, name, blocks').eq('id', workout).maybeSingle();
        if (data) s = { title: data.name, blocks: data.blocks as WorkoutBlock[], assignment: null, workoutId: data.id };
        const c = await sb.from('coach_clients').select('*').eq('status', 'active').order('last_name');
        setClients((c.data as Client[]) ?? []);
      }
      if (s?.assignment?.status === 'done') { setSrc(s); return; }
      const d = readDraft((k) => storage.getItem(k));
      if (s && d?.key === key) { setLog(d.log); setStarted(d.started); if (d.client_id) setClientId(d.client_id); }
      else if (s) setLog(startLog(s.blocks, unit));
      setSrc(s);
    })();
  }, [aid, workout, key, unit]);

  // Keep the draft on the device after every change
  useEffect(() => {
    if (!src || saved.current || src.assignment?.status === 'done' || !log.length) return;
    const d: Draft = { key, title: src.title, params: aid ? { aid } : { workout: workout! }, client_id: clientId, started, log };
    try { storage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage full or blocked: keep going without a draft */ }
  }, [log, clientId, src, key, aid, workout, started]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = rest ? Math.ceil((rest.until - now) / 1000) : 0;
  useEffect(() => { if (rest && left <= 0) setRest(null); }, [rest, left]);

  if (src === undefined) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!src) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔎" title="Workout not found" /></View>;
  if (src.assignment?.status === 'done') {
    return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="✅" title="Already logged" body="This workout is done."
      action={<Button title="See the log" onPress={() => router.replace({ pathname: '/workout/[aid]', params: { aid: aid! } })} />} /></View>;
  }

  const isTrainer = !!app.trainer && (src.assignment ? src.assignment.trainer_id === app.user?.id : true);
  const blocks = src.blocks.filter((b): b is ExerciseBlock => b.kind === 'exercise');
  const setSet = (bi: number, si: number, patch: Partial<SetLog>) =>
    setLog((l) => l.map((e, n) => (n === bi ? { ...e, sets: e.sets.map((s, m) => (m === si ? { ...s, ...patch } : s)) } : e)));
  const done = setsDone(log), total = setsTotal(log);

  const clearDraft = () => { try { if (readDraft((k) => storage.getItem(k))?.key === key) storage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ } };
  const save = async () => {
    if (!app.user) return;
    if (!done) return toast('Tick off at least one set first', false);
    if (isTrainer && !clientId) return toast('Choose who you’re training', false);
    setBusy(true);
    let assignmentId = src.assignment?.id ?? null;
    if (!assignmentId) {
      // A trainer running a library workout: put it on the client's calendar for today, then log it
      const { data, error } = await sb.from('coach_assignments').insert({ trainer_id: app.user.id, client_id: clientId, workout_id: src.workoutId, scheduled_on: dayKey(new Date()), title: src.title, snapshot: src.blocks }).select('id').single();
      if (error) { setBusy(false); return toast(errText(error), false); }
      assignmentId = data.id;
    }
    const { error } = await sb.from('coach_logs').insert({
      assignment_id: assignmentId, client_id: clientId, user_id: app.user.id, duration_seconds: Math.min(86400, Math.round((Date.now() - started) / 1000)),
      entries: doneOnly(log), rpe, note: note.trim() || null, source: isTrainer ? 'trainer' : 'app',
    });
    setBusy(false);
    if (error) return toast(errText(error), false);
    saved.current = true; clearDraft();
    toast('Workout saved. Nice work!');
    router.replace({ pathname: '/workout/[aid]', params: { aid: assignmentId! } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: src.title, headerRight: () => <Txt v="bold" style={{ marginRight: 12, fontVariant: ['tabular-nums'] }}>{clock((now - started) / 1000)}</Txt> }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          {isTrainer && !src.assignment && (
            <Card style={{ gap: 8 }}>
              <Txt v="bold">Who are you training?</Txt>
              {clients.length === 0 ? <Txt v="small">You need an active client to log a session.</Txt> : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {clients.map((c) => <Chip key={c.id} label={c.name} selected={clientId === c.id} onPress={() => setClientId(c.id)} />)}
                </View>
              )}
            </Card>
          )}
          {src.assignment?.trainer_note ? <Card><Txt v="smallBold" color={p.focus}>From your trainer</Txt><Txt>{src.assignment.trainer_note}</Txt></Card> : null}
          <Txt v="small">{done} of {total} sets done{volume(log) ? ` · ${volume(log).toLocaleString()} ${unit} lifted` : ''}</Txt>
          {log.map((e, bi) => {
            const b = blocks.find((x) => x.id === e.block_id);
            const metric = b?.metric ?? 'reps';
            return (
              <Card key={e.block_id} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <ExerciseThumb img={e.ex?.img} video={e.ex?.video} size={52} />
                  <Txt v="h3" style={{ flex: 1 }}>{e.ex?.name ?? 'Exercise'}</Txt>
                </View>
                {b?.note ? <Txt v="small">{b.note}</Txt> : null}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Txt v="smallBold" style={{ width: 34 }}>Set</Txt>
                  {metric !== 'distance' && <Txt v="smallBold" style={{ width: 72, textAlign: 'center' }}>{unit}</Txt>}
                  <Txt v="smallBold" style={{ width: 72, textAlign: 'center' }}>{metric === 'reps' ? 'Reps' : metric === 'time' ? 'Time' : 'Distance'}</Txt>
                </View>
                {e.sets.map((s, si) => (
                  <View key={si} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', opacity: s.done ? 0.7 : 1 }}>
                    <Txt v="bold" style={{ width: 34 }}>{si + 1}</Txt>
                    {metric !== 'distance' && <NumCell label={`Set ${si + 1} weight`} value={s.weight == null ? '' : String(s.weight)} onChange={(t) => setSet(bi, si, { weight: toNum(t) })} />}
                    {metric === 'reps' && <NumCell label={`Set ${si + 1} reps`} value={s.reps == null ? '' : String(s.reps)} onChange={(t) => setSet(bi, si, { reps: toNum(t) })} />}
                    {metric === 'time' && <NumCell label={`Set ${si + 1} time`} value={fmtSeconds(s.time)} onChange={(t) => setSet(bi, si, { time: parseSeconds(t) })} lazy />}
                    {metric === 'distance' && <NumCell label={`Set ${si + 1} distance`} value={s.distance ?? ''} onChange={(t) => setSet(bi, si, { distance: t.slice(0, 20) || null })} />}
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: s.done }} accessibilityLabel={`Set ${si + 1} done`} hitSlop={8}
                      onPress={() => {
                        setSet(bi, si, { done: !s.done });
                        if (!s.done) { const r = restAfter(src.blocks, e.block_id, si); if (r > 0) setRest({ until: Date.now() + r * 1000, total: r }); }
                      }}
                      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? p.good : p.surface, borderWidth: 1.5, borderColor: s.done ? p.good : p.line }}>
                      <Icon name="check" size={22} color={s.done ? '#fff' : p.muted} />
                    </Pressable>
                  </View>
                ))}
                <Button small kind="ghost" title="Add set" icon="add" style={{ alignSelf: 'flex-start' }}
                  onPress={() => setLog((l) => l.map((x, n) => (n === bi ? { ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? {}), done: false }] } : x)))} />
              </Card>
            );
          })}
          <Button kind="quiet" title="Discard workout" style={{ alignSelf: 'center' }} onPress={() => ask('Discard this workout?', 'Nothing you ticked off will be saved.', [
            { text: 'Keep going', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: () => { saved.current = true; clearDraft(); router.back(); } }])} />
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, alignItems: 'center', gap: 10 }} pointerEvents="box-none">
        {rest && (
          <Card style={{ width: '100%', maxWidth: 520, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: p.focus }}>
            <Icon name="timer" color={p.focus} />
            <View style={{ flex: 1 }}>
              <Txt v="smallBold">Rest</Txt>
              <Txt v="h2" accessibilityLiveRegion="polite" style={{ fontVariant: ['tabular-nums'] }}>{clock(left)}</Txt>
            </View>
            <Button small kind="ghost" title="+15s" onPress={() => setRest((r) => r && { ...r, until: r.until + 15000 })} />
            <Button small title="Skip" onPress={() => setRest(null)} />
          </Card>
        )}
        <Button kind="accent" title="Finish workout" icon="check" onPress={() => (done ? setFinishing(true) : toast('Tick off at least one set first', false))} />
      </View>

      <Sheet visible={finishing} onClose={() => setFinishing(false)} title="How did that feel?">
        <Txt v="small" style={{ marginBottom: 8 }}>Effort, from 1 (easy) to 10 (all-out). Optional.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <Chip key={n} label={String(n)} selected={rpe === n} onPress={() => setRpe(rpe === n ? null : n)} />)}
        </View>
        <Field label="Notes" hint="(optional)" value={note} onChangeText={setNote} multiline placeholder="Felt strong, left knee a bit sore" />
        <Txt v="small" style={{ marginBottom: 12 }}>{done} of {total} sets · {clock((now - started) / 1000)}</Txt>
        <Button title="Save workout" busy={busy} onPress={save} style={{ alignSelf: 'flex-start' }} />
      </Sheet>
    </View>
  );
}

const toNum = (t: string) => { const n = Number(t.replace(',', '.')); return t.trim() && Number.isFinite(n) && n >= 0 ? n : null; };

/** Number box; `lazy` commits on blur (for m:ss times) */
function NumCell({ value, onChange, label, lazy }: { value: string; onChange: (t: string) => void; label: string; lazy?: boolean }) {
  const p = usePalette();
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  return (
    <TextInput value={editing ? text : value} accessibilityLabel={label} keyboardType={lazy ? 'numbers-and-punctuation' : 'decimal-pad'} selectTextOnFocus
      onFocus={() => { setText(value); setEditing(true); }}
      onChangeText={(t) => { setText(t); if (!lazy) onChange(t); }}
      onBlur={() => { setEditing(false); if (lazy) onChange(text); }}
      style={{ width: 72, height: 44, borderWidth: 1.5, borderColor: p.line, borderRadius: R.sm, textAlign: 'center', fontFamily: F.body, fontSize: 17, color: p.ink, backgroundColor: p.surface }} />
  );
}
