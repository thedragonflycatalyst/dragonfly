import { router, Stack, useLocalSearchParams } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { ExerciseInfo, ExerciseThumb, useMyExercises } from '@/features/exercises';
import { CUE_LINES, hush, say } from '@/features/lapis/audio';
import { warm } from '@/features/lapis/clips';
import { useLapisPrefs } from '@/features/lapis/prefs';
import { RestBar, SetTimer, useRest } from '@/features/lapis/timers';
import { LinkedLapisRunner } from '@/features/lapis/linked-runner';
import { lapisTimerSeconds, parseLapisTimer } from '@/features/lapis/library';
import type { RunnerClock } from '@/features/lapis/runner-clock';
import { ExerciseHistory } from '@/features/exercise-history';
import { alternativesFor, byRef, titleCase, type LibExercise } from '@/lib/library';
import { ask } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { dayKey } from '@/lib/dates';
import { errText, type Assignment, type Client, type ExerciseBlock, type ExerciseRef, type LapisTimerResult, type LogEntry, type SetLog, type WorkoutBlock } from '@/lib/model';
import { exKey, ghostSet, historyOf, notesOf, setLine, type PastLog } from '@/lib/history';
import { clock, doneOnly, DRAFT_KEY, readDraft, type Draft } from '@/lib/session';
import { weakSide } from '@/lib/sides';
import { storage } from '@/lib/storage';
import { sb } from '@/lib/supabase';
import { weightUnit } from '@/lib/units';
import { fmtSeconds, parseSeconds, refOf, setsDone, setsTotal, startLog, volume } from '@/lib/workouts';
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
  const [timerResults, setTimerResults] = useState<LapisTimerResult[]>([]);
  const [runnerClocks, setRunnerClocks] = useState<Record<string, RunnerClock>>({});
  const [started, setStarted] = useState(Date.now());
  const [clientId, setClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [now, setNow] = useState(Date.now());
  const lapis = useLapisPrefs(app.user?.id);
  const rest = useRest();
  const [past, setPast] = useState<PastLog[]>([]);
  const [historyFor, setHistoryFor] = useState<number | null>(null);
  const [noteIdx, setNoteIdx] = useState<Record<string, number>>({});
  const [manualTime, setManualTime] = useState<Record<string, boolean>>({});
  const [autoGo, setAutoGo] = useState<{ key: string; n: number } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const saveInFlight = useRef(false);
  const [pendingAssignmentId, setPendingAssignmentId] = useState<string | null>(null);
  const saved = useRef(false);
  const [swapping, setSwapping] = useState<number | null>(null);
  const [info, setInfo] = useState<ExerciseRef | null>(null);

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
      if (s && d?.key === key) { setLog(d.log); setTimerResults(d.timerResults ?? []); setRunnerClocks(d.runnerClocks ?? {}); setPendingAssignmentId(d.pendingAssignmentId ?? null); setStarted(d.started); if (d.client_id) setClientId(d.client_id); }
      else if (s) setLog(startLog(s.blocks, unit));
      setSrc(s);
    })();
  }, [aid, workout, key, unit]);

  // Keep the draft on the device after every change
  useEffect(() => {
    if (!src || saved.current || src.assignment?.status === 'done' || (!log.length && !src.blocks.some((b) => b.kind === 'timed'))) return;
    const d: Draft = { key, title: src.title, params: aid ? { aid } : { workout: workout! }, client_id: clientId, started, log, timerResults, runnerClocks, pendingAssignmentId };
    try { storage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage full or blocked: keep going without a draft */ }
  }, [log, timerResults, runnerClocks, pendingAssignmentId, clientId, src, key, aid, workout, started]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // Lapis: fetch the voice lines once, keep the screen on if asked, stop sounds on the way out
  useEffect(() => { void warm(CUE_LINES, lapis.voice, lapis.voiceSpeed); }, [lapis.voice, lapis.voiceSpeed]);
  useEffect(() => {
    if (!lapis.keepAwake) return;
    activateKeepAwakeAsync('workout').catch(() => {});
    return () => { deactivateKeepAwake('workout').catch(() => {}); };
  }, [lapis.keepAwake]);
  useEffect(() => () => hush(), []);
  // This client's past workouts, for last time's numbers and notes
  useEffect(() => {
    if (!clientId) { setPast([]); return; }
    sb.from('coach_logs').select('performed_at, entries').eq('client_id', clientId).order('performed_at', { ascending: false }).limit(60)
      .then(({ data }) => setPast((data as PastLog[] | null) ?? []));
  }, [clientId]);

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
  /** Tick a set off: mark it done and start the Lapis rest from its rest box */
  const tick = (bi: number, si: number, s: SetLog, patch: Partial<SetLog>) => {
    setSet(bi, si, { ...patch, done: true });
    if (!lapis.autoRest) return;
    const e = log[bi];
    const next = si + 1 < e.sets.length ? `Next: set ${si + 2}` : log[bi + 1]?.ex ? `Next: ${log[bi + 1].ex?.name}` : 'Last set done';
    // Timed exercises run like a Lapis session: work, rest, then the next set starts by itself
    const timed = blocks.find((x) => x.id === e.block_id)?.metric === 'time' && !manualTime[e.block_id] && si + 1 < e.sets.length;
    rest.start(s.rest ?? lapis.defaultRest, next, timed ? () => setAutoGo({ key: `${bi}:${si + 1}:${e.sides ? 'r' : '-'}`, n: Date.now() }) : undefined);
  };

  const clearDraft = () => { try { if (readDraft((k) => storage.getItem(k))?.key === key) storage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ } };
  const save = async () => {
    if (saveInFlight.current || !app.user) return;
    if (!done && !timerResults.length) return toast('Complete an exercise set or Lapis timer first', false);
    if (isTrainer && !clientId) return toast('Choose who you’re training', false);
    saveInFlight.current = true;
    setBusy(true);
    try {
      let assignmentId = src.assignment?.id ?? pendingAssignmentId;
      if (!assignmentId) {
        // Create at most one assignment for this local session. If logging fails,
        // persist its ID so retry/restart doesn't make duplicate calendar entries.
        const { data, error } = await sb.from('coach_assignments').insert({
          trainer_id: app.user.id, client_id: clientId,
          workout_id: src.workoutId, scheduled_on: dayKey(new Date()),
          title: src.title, snapshot: src.blocks,
        }).select('id').single();
        if (error) throw error;
        assignmentId = data.id as string;
        setPendingAssignmentId(assignmentId);
        const draft: Draft = {
          key, title: src.title, params: aid ? { aid } : { workout: workout! },
          client_id: clientId, started, log, timerResults, runnerClocks,
          pendingAssignmentId: assignmentId,
        };
        try { storage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* stay usable in-memory */ }
      }
      const { error } = await sb.from('coach_logs').insert({
        assignment_id: assignmentId, client_id: clientId, user_id: app.user.id,
        duration_seconds: Math.min(86400, Math.max(0, Math.round((Date.now() - started) / 1000))),
        entries: doneOnly(log), timer_results: timerResults, rpe,
        note: note.trim() || null, source: isTrainer ? 'trainer' : 'app',
      });
      if (error) {
        // A concurrent save on another device may already have succeeded.
        // Only treat a duplicate as success if the log truly exists.
        if (error.code !== '23505') throw error;
        const existing = await sb.from('coach_logs')
          .select('id').eq('assignment_id', assignmentId).maybeSingle();
        if (existing.error || !existing.data) throw error;
      }
      saved.current = true;
      clearDraft();
      toast('Workout saved. Nice work!');
      router.replace({ pathname: '/workout/[aid]', params: { aid: assignmentId! } });
    } catch (error) {
      toast(errText(error), false);
    } finally {
      saveInFlight.current = false;
      setBusy(false);
    }
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
          {src.blocks.filter((b) => b.kind === 'timed').map((b) => {
            if (b.kind !== 'timed') return null;
            const savedTimer = b.timer.source?.app === 'lapis'
              ? parseLapisTimer(b.timer.source.snapshot) : null;
            return savedTimer
              ? <LinkedLapisRunner key={b.id} timer={savedTimer} initialClock={runnerClocks[b.id]} onClockChange={(clock) => setRunnerClocks((prev) => ({ ...prev, [b.id]: clock }))} onStart={() => setTimerResults((prior) => prior.filter((x) => x.block_id !== b.id))} onReset={() => setTimerResults((prior) => prior.filter((x) => x.block_id !== b.id))} onComplete={(actualSeconds) => {
                  const result: LapisTimerResult = {
                    block_id: b.id, timer_id: savedTimer.id, name: savedTimer.name,
                    planned_seconds: lapisTimerSeconds(savedTimer), actual_seconds: Math.round(actualSeconds),
                    completed_at: new Date().toISOString(),
                  };
                  setTimerResults((prior) => [...prior.filter((x) => x.block_id !== b.id), result]);
                }} />
              : <Card key={b.id}><Txt v="bold">{b.name}</Txt><Txt v="small" color={p.muted}>This older timer needs to be linked again from the workout builder.</Txt></Card>;
          })}
          <Txt v="small">{done} of {total} sets done{volume(log) ? ` · ${volume(log).toLocaleString()} ${unit} lifted` : ''}</Txt>
          {log.map((e, bi) => {
            const b = blocks.find((x) => x.id === e.block_id);
            const metric = b?.metric ?? 'reps';
            const sides = !!e.sides;
            const hist = historyOf(past, exKey(e.ex));
            const notes = notesOf(hist);
            const ni = Math.min(noteIdx[e.block_id] ?? 0, Math.max(0, notes.length - 1));
            return (
              <Card key={e.block_id} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${e.ex?.name ?? 'Exercise'} details`} onPress={() => e.ex && setInfo(e.ex)}><ExerciseThumb img={e.ex?.img} video={e.ex?.video} size={52} /></Pressable>
                  <View style={{ flex: 1 }}>
                    <Txt v="h3">{e.ex?.name ?? 'Exercise'}</Txt>
                    {e.swapped_from ? <Txt v="small">Instead of {e.swapped_from}</Txt> : null}
                  </View>
                  {hist.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`${e.ex?.name ?? 'Exercise'} history`} hitSlop={8} onPress={() => setHistoryFor(bi)}><Icon name="history" color={p.focus} /></Pressable>}
                  {e.ex && <Button small kind="quiet" icon="swap_horiz" title="Swap" onPress={() => setSwapping(bi)} />}
                </View>
                {b?.note ? <Txt v="small">{b.note}</Txt> : null}
                {hist[0] ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`${e.ex?.name ?? 'Exercise'} history`} onPress={() => setHistoryFor(bi)}>
                    <Txt v="small" style={{ opacity: 0.6 }} numberOfLines={2}>Last time ({shortDate(hist[0].at)}): {hist[0].sets.map((x) => setLine(x, hist[0].unit)).join(', ')}</Txt>
                  </Pressable>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Txt v="smallBold" style={{ width: 26 }}>Set</Txt>
                  {metric !== 'distance' && <Txt v="smallBold" style={{ flex: 1, textAlign: 'center' }}>{unit}</Txt>}
                  {sides ? <>
                    <Txt v="smallBold" style={{ flex: 1, textAlign: 'center' }}>Right</Txt>
                    <Txt v="smallBold" style={{ flex: 1, textAlign: 'center' }}>Left</Txt>
                  </> : <Txt v="smallBold" style={{ flex: 1, textAlign: 'center' }}>{metric === 'reps' ? 'Reps' : metric === 'time' ? 'Time' : 'Distance'}</Txt>}
                  <Txt v="smallBold" style={{ width: 58, textAlign: 'center' }}>Rest</Txt>
                  <View style={{ width: 44, alignItems: 'center' }}>
                    {metric === 'time' && (
                      <Pressable accessibilityRole="switch" accessibilityState={{ checked: !manualTime[e.block_id] }} accessibilityLabel="Use the Lapis timer for time" hitSlop={8}
                        onPress={() => setManualTime((m) => ({ ...m, [e.block_id]: !m[e.block_id] }))}>
                        <Icon name={manualTime[e.block_id] ? 'keyboard' : 'timer'} size={20} color={p.focus} />
                      </Pressable>
                    )}
                  </View>
                </View>
                {e.sets.map((s, si) => {
                  const g = ghostSet(hist, si);
                  const gh = (v: number | null | undefined, f: (n: number) => string = String) => (v == null ? undefined : f(v));
                  const lapisTime = metric === 'time' && !manualTime[e.block_id];
                  const gap = sides ? (metric === 'time' ? weakSide(s.time_l, s.time_r) : weakSide(s.reps_l, s.reps_r)) : null;
                  const cell = (side: 'l' | 'r' | null) => {
                    const rk = side ? (`reps_${side}` as const) : 'reps';
                    const tk = side ? (`time_${side}` as const) : 'time';
                    const who = side === 'l' ? ' left' : side === 'r' ? ' right' : '';
                    const short = gap && side && gap.side === side.toUpperCase();
                    if (metric === 'reps') return <NumCell key={rk} label={`Set ${si + 1}${who} reps`} warn={!!short} placeholder={gh(g?.[rk] ?? g?.reps)} value={s[rk] == null ? '' : String(s[rk])} onChange={(t) => setSet(bi, si, { [rk]: toNum(t) })} />;
                    if (metric === 'time') {
                      if (lapisTime) {
                        const k = `${bi}:${si}:${side ?? '-'}`;
                        return <SetTimer key={tk} label={`set ${si + 1}${who}`} target={s[tk] ?? null} compact={!!side} go={autoGo?.key === k ? autoGo.n : undefined}
                          onDone={(sec) => {
                            const patch: Partial<SetLog> = { [tk]: sec };
                            // Right side done: switch and start the left; both done (or one-sided): tick the set and rest
                            if (side === 'r') { setSet(bi, si, patch); void say('Switch sides'); setAutoGo({ key: `${bi}:${si}:l`, n: Date.now() }); }
                            else tick(bi, si, { ...s, ...patch }, patch);
                          }} />;
                      }
                      return <NumCell key={tk} label={`Set ${si + 1}${who} time`} warn={!!short} placeholder={gh(g?.[tk] ?? g?.time, (n) => fmtSeconds(n))} value={fmtSeconds(s[tk])} onChange={(t) => setSet(bi, si, { [tk]: parseSeconds(t) })} lazy />;
                    }
                    return <NumCell key="d" label={`Set ${si + 1} distance`} placeholder={g?.distance ?? undefined} value={s.distance ?? ''} onChange={(t) => setSet(bi, si, { distance: t.slice(0, 20) || null })} />;
                  };
                  return (
                    <View key={si} style={{ gap: 2 }}>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', opacity: s.done ? 0.7 : 1 }}>
                        <Txt v="bold" style={{ width: 26 }}>{si + 1}</Txt>
                        {metric !== 'distance' && <NumCell label={`Set ${si + 1} weight`} placeholder={gh(g?.weight)} value={s.weight == null ? '' : String(s.weight)} onChange={(t) => setSet(bi, si, { weight: toNum(t) })} />}
                        {sides ? <>{cell('r')}{cell('l')}</> : cell(null)}
                        <NumCell label={`Rest after set ${si + 1}`} width={58} placeholder={fmtSeconds(lapis.defaultRest)} value={s.rest == null ? '' : fmtSeconds(s.rest)} onChange={(t) => setSet(bi, si, { rest: parseSeconds(t) })} lazy />
                        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: s.done }} accessibilityLabel={`Set ${si + 1} done`} hitSlop={8}
                          onPress={() => (s.done ? setSet(bi, si, { done: false }) : tick(bi, si, s, {}))}
                          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? p.good : p.surface, borderWidth: 1.5, borderColor: s.done ? p.good : p.line }}>
                          <Icon name="check" size={22} color={s.done ? '#fff' : p.muted} />
                        </Pressable>
                      </View>
                      {gap ? <Txt v="smallBold" color={p.gold} style={{ marginLeft: 32 }}>{gap.side === 'L' ? 'Left' : 'Right'} {metric === 'time' ? `${gap.by}s` : gap.by} short</Txt> : null}
                    </View>
                  );
                })}
                <Button small kind="ghost" title="Add set" icon="add" style={{ alignSelf: 'flex-start' }}
                  onPress={() => setLog((l) => l.map((x, n) => (n === bi ? { ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? {}), done: false }] } : x)))} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                  <TextInput value={e.note ?? ''} onChangeText={(t) => setLog((l) => l.map((x, n) => (n === bi ? { ...x, note: t.slice(0, 500) } : x)))} multiline
                    accessibilityLabel={`${e.ex?.name ?? 'Exercise'} note`} placeholder={notes[ni] ? notes[ni].note : 'Note for next time'} placeholderTextColor={notes[ni] ? p.muted : `${p.muted}99`}
                    style={{ flex: 1, minHeight: 44, borderWidth: 1, borderColor: p.line, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 10, fontFamily: F.body, fontSize: 15, color: p.ink, backgroundColor: p.surface }} />
                  {notes.length > 0 && !(e.note ?? '') ? (
                    <View style={{ alignItems: 'center', minWidth: 44 }}>
                      <View style={{ flexDirection: 'row' }}>
                        <Pressable accessibilityRole="button" accessibilityLabel="Older note" disabled={ni >= notes.length - 1} hitSlop={6} onPress={() => setNoteIdx((m) => ({ ...m, [e.block_id]: ni + 1 }))}>
                          <Icon name="chevron_left" size={20} color={ni >= notes.length - 1 ? p.line : p.muted} />
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel="Newer note" disabled={ni === 0} hitSlop={6} onPress={() => setNoteIdx((m) => ({ ...m, [e.block_id]: ni - 1 }))}>
                          <Icon name="chevron_right" size={20} color={ni === 0 ? p.line : p.muted} />
                        </Pressable>
                      </View>
                      <Txt v="small" style={{ fontSize: 11, opacity: 0.7 }}>{shortDate(notes[ni].at)}</Txt>
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })}
          <Button kind="quiet" title="Discard workout" style={{ alignSelf: 'center' }} onPress={() => ask('Discard this workout?', 'Nothing you ticked off will be saved.', [
            { text: 'Keep going', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: () => { saved.current = true; clearDraft(); router.back(); } }])} />
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, alignItems: 'center', gap: 10 }} pointerEvents="box-none">
        <RestBar t={rest} />
        <Button kind="accent" title="Finish workout" icon="check" onPress={() => (done || timerResults.length ? setFinishing(true) : toast('Complete an exercise set or Lapis timer first', false))} />
      </View>

      <SwapSheet entry={swapping !== null ? log[swapping] : null} trainerId={src.assignment?.trainer_id ?? app.trainer?.user_id} onClose={() => setSwapping(null)}
        onSwap={(alt) => { const i = swapping!; setLog((l) => l.map((x, n) => (n === i ? { ...x, ex: refOf(alt), swapped_from: x.swapped_from ?? x.ex?.name } : x))); setSwapping(null); }} />
      <ExerciseHistory entry={historyFor !== null ? log[historyFor] : null} history={historyFor !== null ? historyOf(past, exKey(log[historyFor]?.ex)) : []} onClose={() => setHistoryFor(null)} />
      <ExerciseInfo ex={info ? { name: info.name, ref: `${info.src}:${info.id}`, img: info.img, video: info.video } : null} onClose={() => setInfo(null)} />
      <Sheet visible={finishing} onClose={() => setFinishing(false)} title="How did that feel?">
        <Txt v="small" style={{ marginBottom: 8 }}>Effort, from 1 (easy) to 10 (all-out). Optional.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <Chip key={n} label={String(n)} selected={rpe === n} onPress={() => setRpe(rpe === n ? null : n)} />)}
        </View>
        <Field label="Notes" hint="(optional)" value={note} onChangeText={setNote} multiline placeholder="Felt strong, left knee a bit sore" />
        <Txt v="small" style={{ marginBottom: 12 }}>{done} of {total} sets · {timerResults.length} Lapis timers · {clock((now - started) / 1000)}</Txt>
        <Button title="Save workout" busy={busy} onPress={save} style={{ alignSelf: 'flex-start' }} />
      </Sheet>
    </View>
  );
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const toNum = (t: string) => { const n = Number(t.replace(',', '.')); return t.trim() && Number.isFinite(n) && n >= 0 ? n : null; };

/** Number box; `lazy` commits on blur (for m:ss times) */
function NumCell({ value, onChange, label, lazy, placeholder, warn, width }: { value: string; onChange: (t: string) => void; label: string; lazy?: boolean; placeholder?: string; warn?: boolean; width?: number }) {
  const p = usePalette();
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  return (
    <TextInput value={editing ? text : value} accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={`${p.muted}88`} keyboardType={lazy ? 'numbers-and-punctuation' : 'decimal-pad'} selectTextOnFocus
      onFocus={() => { setText(value); setEditing(true); }}
      onChangeText={(t) => { setText(t); if (!lazy) onChange(t); }}
      onBlur={() => { setEditing(false); if (lazy) onChange(text); }}
      style={{ ...(width ? { width } : { flex: 1, minWidth: 0 }), height: 44, borderWidth: 1.5, borderColor: warn ? p.gold : p.line, borderRadius: R.sm, textAlign: 'center', fontFamily: F.body, fontSize: 17, color: p.ink, backgroundColor: p.surface }} />
  );
}

/** Swap an exercise mid-workout: the trainer's chosen alternatives first, then similar moves from the library */
function SwapSheet({ entry, trainerId, onClose, onSwap }: { entry: LogEntry | null; trainerId?: string; onClose: () => void; onSwap: (e: LibExercise) => void }) {
  const p = usePalette();
  const { mine } = useMyExercises(entry ? trainerId : undefined);
  const current = entry?.ex ? byRef(`${entry.ex.src}:${entry.ex.id}`, mine) : undefined;
  const options = current ? alternativesFor(current, mine) : [];
  const chosen = new Set(current?.alts ?? []);
  return (
    <Sheet visible={!!entry} onClose={onClose} title={`Swap ${entry?.ex?.name ?? 'exercise'}`}>
      {options.length === 0 && <Txt>No alternatives for this one.</Txt>}
      {options.map((e) => (
        <Pressable key={e.ref} accessibilityRole="button" accessibilityLabel={`Swap to ${e.name}`} onPress={() => onSwap(e)}
          style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.line, opacity: pressed ? 0.6 : 1 })}>
          <ExerciseThumb img={e.images[0]} video={e.video} size={52} />
          <View style={{ flex: 1 }}>
            <Txt v="bold">{e.name}</Txt>
            <Txt v="small">{[chosen.has(e.ref) ? 'Picked by your trainer' : null, titleCase(e.equipment)].filter(Boolean).join(' · ')}</Txt>
          </View>
          <Icon name="swap_horiz" color={p.focus} />
        </Pressable>
      ))}
      <Txt v="small" style={{ marginTop: 10 }}>Your sets and numbers stay the same; your trainer sees what you swapped.</Txt>
    </Sheet>
  );
}
