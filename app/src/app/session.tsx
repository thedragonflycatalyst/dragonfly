import { router, Stack, useIsFocused, useLocalSearchParams } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { ActivityIndicator, AppState, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Toggle } from '@/components/pickers';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { ExerciseInfo, ExerciseThumb, useMyExercises } from '@/features/exercises';
import { CUE_LINES, hush, say } from '@/features/lapis/audio';
import { warm } from '@/features/lapis/clips';
import { useLapisPrefs } from '@/features/lapis/prefs';
import { RestBar, SetTimer, useRest, clearOtherWorkoutRestReminders, clearWorkoutRestReminder } from '@/features/lapis/timers';
import { LinkedLapisRunner } from '@/features/lapis/linked-runner';
import { lapisReminderKey, activateLapisReminderSession, releaseLapisReminderSession, clearWorkoutLinkedReminders } from '@/features/lapis/background';
import { claimWorkoutSession, isWorkoutSessionOwner, releaseWorkoutSession } from '@/features/lapis/workout-session-lease';
import { patchDraftClock, patchDraftTimedSetClock, patchDraftRestClock } from '@/features/lapis/navigation-recovery';
import type { RestClock } from '@/features/lapis/rest-clock';
import type { TimedSetClock } from '@/features/lapis/timed-set-clock';
import { lapisTimerSeconds, parseLapisTimer, type LapisTimer } from '@/features/lapis/library';
import type { RunnerClock } from '@/features/lapis/runner-clock';
import { matchesPendingAssignment } from '@/features/lapis/integration-guards';
import { recoverLinkedClocks, recoverTimedSetClocks } from '@/features/lapis/session-recovery';
import { canResumeRest, canStartLinkedTimer, canStartTimedSet } from '@/features/lapis/timer-ownership';
import { activeWorkoutTimers, clearTimerCompletion, recordTimerCompletion, shouldAcceptTimedSetCompletion } from '@/features/lapis/completion-integrity';
import { canMutateWorkoutTimer } from '@/features/lapis/save-finalization';
import { timerInstanceKey } from '@/features/lapis/timer-instance';
import { ExerciseHistory } from '@/features/exercise-history';
import { EquipmentSettings } from '@/features/equipment-settings';
import { cleanSettings, lastSettings, settingFields } from '@/lib/equipment-settings';
import { useHidden } from '@/features/library-extras';
import { alternativesFor, byRef, titleCase, type LibExercise } from '@/lib/library';
import { ask } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { dayKey } from '@/lib/dates';
import { errText, type Assignment, type Client, type ExerciseBlock, type ExerciseRef, type LapisTimerResult, type LogEntry, type SetLog, type WorkoutBlock } from '@/lib/model';
import { exKey, ghostSet, historyOf, notesOf, pastSwaps, setLine, type PastLog } from '@/lib/history';
import { clock, doneOnly, type Draft } from '@/lib/session';
import { dropLiveWorkout, onAutoSubmitted, syncLiveWorkout } from '@/features/auto-submit';
import { weakSide } from '@/lib/sides';
import { storage } from '@/lib/storage';
import { beginWorkoutDraft, writeDraftCore, writeDraftPatch, clearMatchingDraft, workoutDraftSlot, loadWorkoutDraft } from '@/lib/draft-integrity';
import { sb } from '@/lib/supabase';
import { weightUnit } from '@/lib/units';
import { fmtSeconds, parseSeconds, refOf, setsDone, setsTotal, startLog, swapBlock, volume } from '@/lib/workouts';
import { F, MAX_W, R, usePalette } from '@/lib/theme';

type Source = { title: string; blocks: WorkoutBlock[]; assignment: Assignment | null; workoutId: string | null };

/** Live workout: tick off sets, adjust numbers, rest timer between sets, then save. Works for a client or for the trainer running a session. */
export default function Session() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { aid, workout, client: clientParam } = useLocalSearchParams<{ aid?: string; workout?: string; client?: string }>();
  const screenFocused = useIsFocused();
  const key = aid ? `a:${aid}` : `w:${workout}`;
  const currentRouteKey = useRef(key);
  currentRouteKey.current = key;
  const sessionId = `${app.user?.id ?? 'unknown'}:${key}`;
  const leaseToken = useRef(Crypto.randomUUID());
  const [ownsSession, setOwnsSession] = useState(false);
  useEffect(() => {
    const token = leaseToken.current;
    if (!screenFocused) {
      if (releaseWorkoutSession(token)) {
        releaseLapisReminderSession(sessionId);
        hush();
      }
      setOwnsSession(false);
      return;
    }
    claimWorkoutSession(token, sessionId);
    setOwnsSession(true);
    void activateLapisReminderSession(sessionId);
    void clearOtherWorkoutRestReminders(sessionId);
    return () => {
      if (releaseWorkoutSession(token)) {
        releaseLapisReminderSession(sessionId);
        hush();
      }
    };
  }, [screenFocused, sessionId]);
  const unit = weightUnit(app.units);
  const [src, setSrc] = useState<Source | null | undefined>(undefined);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const activeScreen = screenFocused && ownsSession && readyKey === key && isWorkoutSessionOwner(leaseToken.current);
  // Parse snapshots once when the assigned workout changes, rather than on
  // every 200 ms runner tick or every exercise-set update.
  const linkedTimers = useMemo(() => {
    const parsed: Record<string, LapisTimer> = {};
    for (const block of src?.blocks ?? []) {
      if (block.kind !== 'timed' || block.timer.source?.app !== 'lapis') continue;
      const timer = parseLapisTimer(block.timer.source.snapshot);
      if (timer) parsed[block.id] = timer;
    }
    return parsed;
  }, [src]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [timerResults, setTimerResults] = useState<LapisTimerResult[]>([]);
  const [runnerClocks, setRunnerClocks] = useState<Record<string, RunnerClock>>({});
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [activeSetTimerKey, setActiveSetTimerKey] = useState<string | null>(null);
  const [timedSetClocks, setTimedSetClocks] = useState<Record<string, TimedSetClock>>({});
  const [started, setStarted] = useState(Date.now());
  const [clientId, setClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [now, setNow] = useState(Date.now());
  const lapis = useLapisPrefs(app.user?.id);
  const [past, setPast] = useState<PastLog[]>([]);
  const [historyFor, setHistoryFor] = useState<number | null>(null);
  const [noteIdx, setNoteIdx] = useState<Record<string, number>>({});
  const [manualTime, setManualTime] = useState<Record<string, boolean>>({});
  const [autoGo, setAutoGo] = useState<{ key: string; n: number } | null>(null);
  const [restSnapshot, setRestSnapshot] = useState<RestClock | null>(null);
  const saveLocked = useRef(false);
  const rest = useRest(sessionId,
    (nextSetKey) => {
      if (!canMutateWorkoutTimer(key, currentRouteKey.current, saveLocked.current, saved.current)) return;
      // A rest that expired while another screen or the OS was foregrounded
      // must not surprise-start a timed exercise on return.
      if (activeScreen && AppState.currentState === 'active')
        setAutoGo({ key: nextSetKey, n: Date.now() });
    },
    (snapshot) => {
      if (saved.current || currentRouteKey.current !== key) return;
      setRestSnapshot(snapshot);
      try {
        const serialized = patchDraftRestClock(
          loadWorkoutDraft(storage, key), key, snapshot);
        if (serialized) storage.setItem(workoutDraftSlot(key), serialized);
      } catch { /* keep in-memory rest state */ }
    },
  );
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const saveInFlight = useRef(false);
  const completedSetEvents = useRef(new Set<string>());
  const [pendingAssignmentId, setPendingAssignmentId] = useState<string | null>(null);
  const saved = useRef(false);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (liveTimer.current) clearTimeout(liveTimer.current); }, []);
  const [swapping, setSwapping] = useState<number | null>(null);
  const [info, setInfo] = useState<ExerciseRef | null>(null);

  // Load the workout (or assignment) and any unfinished draft of it
  useEffect(() => {
    let cancelled = false;
    setReadyKey(null);
    setSrc(undefined);
    saved.current = false;
    saveLocked.current = false;
    completedSetEvents.current.clear();
    setActiveSetTimerKey(null);
    setAutoGo(null);
    (async () => {
      let s: Source | null = null;
      if (aid) {
        const { data } = await sb.from('coach_assignments').select('*').eq('id', aid).maybeSingle();
        if (cancelled) return;
        const a = data as Assignment | null;
        if (a) { s = { title: a.title, blocks: a.snapshot, assignment: a, workoutId: a.workout_id }; setClientId(a.client_id); }
      } else if (workout) {
        const { data } = await sb.from('coach_workouts').select('id, name, blocks').eq('id', workout).maybeSingle();
        if (cancelled) return;
        if (data) s = { title: data.name, blocks: data.blocks as WorkoutBlock[], assignment: null, workoutId: data.id };
        const c = await sb.from('coach_clients').select('*').eq('status', 'active').order('last_name');
        if (cancelled) return;
        setClients((c.data as Client[]) ?? []);
      }
      if (cancelled) return;
      if (s?.assignment?.status === 'done') { setSrc(s); setReadyKey(key); return; }
      const d = loadWorkoutDraft(storage, key);
      const totals: Record<string, number> = {};
      for (const block of s?.blocks ?? []) {
        if (block.kind !== 'timed' || block.timer.source?.app !== 'lapis') continue;
        const timer = parseLapisTimer(block.timer.source.snapshot);
        if (timer) totals[block.id] = lapisTimerSeconds(timer);
      }
      const recoveredLinked = recoverLinkedClocks(d?.runnerClocks, totals,
        (d?.timerResults ?? []).map((result) => result.block_id), Date.now());
      const recoveredSets = recoverTimedSetClocks(d?.timedSetClocks, Date.now());
      if (s && d?.key === key) {
        rest.restore(d.restClock ?? null);
        setLog(d.log);
        setTimerResults(d.timerResults ?? []);
        setRunnerClocks(recoveredLinked);
        setTimedSetClocks(recoveredSets);
        setActiveTimerId(null);
        setPendingAssignmentId(d.pendingAssignmentId ?? null);
        setStarted(d.started);
        setClientId(d.client_id ?? s.assignment?.client_id ?? null);
      }
      else if (s) {
        rest.restore(null);
        setLog(startLog(s.blocks, unit));
        setTimerResults([]);
        setRunnerClocks({});
        setTimedSetClocks({});
        setActiveTimerId(null);
        setActiveSetTimerKey(null);
        setPendingAssignmentId(null);
        setStarted(Date.now());
        // The client is chosen before the workout opens (Start workout → pick the client) and can't change after
        setClientId(s.assignment?.client_id ?? clientParam ?? null);
      }
      if (cancelled) return;
      if (s) {
        // Each workout owns its own slot; leaving a workout never deletes another
        // unfinished workout or its saved timer progress.
        const initial: Draft = {
          key, title: s.title, params: aid ? { aid } : { workout: workout! },
          client_id: d?.key === key ? d.client_id : (s.assignment?.client_id ?? null),
          started: d?.key === key ? d.started : Date.now(),
          log: d?.key === key ? d.log : startLog(s.blocks, unit),
          timerResults: d?.key === key ? d.timerResults ?? [] : [],
          runnerClocks: d?.key === key ? recoveredLinked : {},
          timedSetClocks: d?.key === key ? recoveredSets : {},
          restClock: d?.key === key ? d.restClock ?? null : null,
          pendingAssignmentId: d?.key === key ? d.pendingAssignmentId ?? null : null,
        };
        try {
          beginWorkoutDraft(storage, workoutDraftSlot(key), initial);
          // Normalize the saved clock before mounting timer children; never
          // let a stale running checkpoint auto-complete after app restart.
          writeDraftPatch(storage, workoutDraftSlot(key), key, {
            runnerClocks: initial.runnerClocks, timedSetClocks: initial.timedSetClocks,
          });
        } catch { /* retain progress in memory if storage is unavailable */ }
      }
      setSrc(s);
      setReadyKey(key);
    })();
    return () => { cancelled = true; };
  }, [aid, workout, key, unit]);

  // Keep the draft on the device after every change
  useEffect(() => {
    if (!src || readyKey !== key || saved.current || src.assignment?.status === 'done' || (!log.length && !src.blocks.some((b) => b.kind === 'timed'))) return;
    // touched: any change counts as activity; 4 hours without one and the workout saves on its own
    const d: Draft = { key, title: src.title, params: aid ? { aid } : { workout: workout! }, client_id: clientId, started, log, timerResults, runnerClocks, timedSetClocks, restClock: restSnapshot, pendingAssignmentId, touched: Date.now() };
    try { writeDraftCore(storage, workoutDraftSlot(key), d); } catch { /* storage full or blocked: keep going without a draft */ }
    // The server's copy (assigned workouts), so it can submit after 4 idle hours even if this phone is off
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = setTimeout(() => { if (!saved.current) void syncLiveWorkout(d).catch(() => {}); }, 3000);
  }, [log, timerResults, runnerClocks, timedSetClocks, restSnapshot, pendingAssignmentId, clientId, src, readyKey, key, aid, workout, started]);

  // Submitted on its own after 4 hours idle (features/auto-submit) while this screen was open: close up like a normal save
  useEffect(() => onAutoSubmitted((k, assignmentId) => {
    if (k !== key || saved.current) return;
    saved.current = true;
    rest.skip();
    hush();
    void clearWorkoutRestReminder(sessionId);
    void clearWorkoutLinkedReminders(sessionId, Object.keys(linkedTimers));
    toast('This workout was submitted automatically after 4 hours without activity');
    router.replace({ pathname: '/workout/[aid]', params: { aid: assignmentId, done: '1' } });
  }), [key, sessionId, linkedTimers, rest, toast]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // Lapis: fetch the voice lines once, keep the screen on if asked, stop sounds on the way out
  useEffect(() => { void warm(CUE_LINES, lapis.voice, lapis.voiceSpeed); }, [lapis.voice, lapis.voiceSpeed]);
  useEffect(() => {
    if (!lapis.keepAwake) return;
    activateKeepAwakeAsync('workout').catch(() => {});
    return () => { deactivateKeepAwake('workout').catch(() => {}); };
  }, [lapis.keepAwake]);
  // Audio cleanup happens only when this workout releases its lease.
  // Route changes pause the rest countdown and silence current cues. The
  // unfinished workout draft remains available on return.
  useEffect(() => {
    if (activeScreen) return;
    rest.pause();
    setActiveSetTimerKey(null);
  }, [activeScreen]);
  // This client's past workouts, for last time's numbers and notes
  useEffect(() => {
    if (!clientId) { setPast([]); return; }
    sb.from('coach_logs').select('performed_at, entries').eq('client_id', clientId).order('performed_at', { ascending: false }).limit(60)
      .then(({ data }) => setPast((data as PastLog[] | null) ?? []));
  }, [clientId]);

  // Carry machine settings over from last time (only into exercises that don't have any yet)
  useEffect(() => {
    if (!past.length) return;
    setLog((l) => {
      let changed = false;
      const next = l.map((e) => {
        if (e.settings) return e;
        const s = lastSettings(historyOf(past, exKey(e.ex)));
        if (!s) return e;
        changed = true;
        return { ...e, settings: { ...s } };
      });
      return changed ? next : l;
    });
  }, [past, log.length]);

  if (src === undefined) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!src) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔎" title="Workout not found" /></View>;
  if (src.assignment?.status === 'done') {
    return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="✅" title="Already logged" body="This workout is done."
      action={<Button title="See the log" onPress={() => router.replace({ pathname: '/workout/[aid]', params: { aid: aid! } })} />} /></View>;
  }

  const isTrainer = !!app.trainer && (src.assignment ? src.assignment.trainer_id === app.user?.id : true);
  /** Makes a swap permanent: the workout, and this client's upcoming (not yet done) sessions of it */
  const swapForGood = async (blockId: string, from: ExerciseRef, to: ExerciseRef) => {
    const wid = src.workoutId;
    if (!wid) return;
    try {
      const { data: w, error } = await sb.from('coach_workouts').select('blocks').eq('id', wid).single();
      if (error) throw error;
      const blocks = swapBlock(w.blocks as WorkoutBlock[], blockId, from, to);
      if (!blocks) { toast(`${from.name} isn’t in the workout any more, so only today changed`, false); return; }
      const up = await sb.from('coach_workouts').update({ blocks }).eq('id', wid);
      if (up.error) throw up.error;
      let later = 0;
      if (clientId) {
        const { data: next } = await sb.from('coach_assignments').select('id, snapshot').eq('workout_id', wid).eq('client_id', clientId)
          .eq('status', 'scheduled').gte('scheduled_on', dayKey(new Date()));
        for (const a of (next ?? []) as { id: string; snapshot: WorkoutBlock[] }[]) {
          const snap = swapBlock(a.snapshot, blockId, from, to);
          if (snap && !(await sb.from('coach_assignments').update({ snapshot: snap }).eq('id', a.id)).error) later++;
        }
      }
      toast(`${to.name} replaces ${from.name} in “${src.title}”${later ? ` and ${later} upcoming session${later === 1 ? '' : 's'}` : ''}`);
    } catch (e) { toast(`Swapped for today, but the workout couldn’t be changed: ${errText(e)}`, false); }
  };
  const blocks = src.blocks.filter((b): b is ExerciseBlock => b.kind === 'exercise');
  const setSet = (bi: number, si: number, patch: Partial<SetLog>) =>
    setLog((l) => l.map((e, n) => (n === bi ? { ...e, sets: e.sets.map((s, m) => (m === si ? { ...s, ...patch } : s)) } : e)));
  const done = setsDone(log), total = setsTotal(log);
  /** Tick a set off: mark it done and start the Lapis rest from its rest box */
  const tick = (bi: number, si: number, s: SetLog, patch: Partial<SetLog>) => {
    if (!activeScreen || !canMutateWorkoutTimer(key, currentRouteKey.current, saveLocked.current, saved.current)) return;
    setSet(bi, si, { ...patch, done: true });
    if (!lapis.autoRest || activeTimerId !== null) return;
    const e = log[bi];
    const next = si + 1 < e.sets.length ? `Next: set ${si + 2}` : log[bi + 1]?.ex ? `Next: ${log[bi + 1].ex?.name}` : 'Last set done';
    // Timed exercises run like a Lapis session: work, rest, then the next set starts by itself
    const timed = blocks.find((x) => x.id === e.block_id)?.metric === 'time' && !manualTime[e.block_id] && si + 1 < e.sets.length;
    rest.start(s.rest ?? lapis.defaultRest, next, timed ? `${bi}:${si + 1}:${e.sides ? 'r' : '-'}` : null);
  };

  const clearDraft = () => { try { clearMatchingDraft(storage, workoutDraftSlot(key), key); } catch { /* nothing to clear */ } };
  const timersActive = activeWorkoutTimers(runnerClocks, timedSetClocks, activeTimerId, activeSetTimerKey);
  const save = async () => {
    if (saveInFlight.current || saved.current || !app.user || !activeScreen || currentRouteKey.current !== key) return;
    if (activeWorkoutTimers(runnerClocks, timedSetClocks, activeTimerId, activeSetTimerKey))
      return toast('Pause or finish all active timers before saving the workout', false);
    if (!done && !timerResults.length) return toast('Complete an exercise set or Lapis timer first', false);
    if (isTrainer && !clientId) return toast('Choose who you’re training', false);
    saveInFlight.current = true;
    saveLocked.current = true;
    rest.pause(); // Freeze automatic rest-to-set transitions during the save.
    setAutoGo(null);
    hush();
    setBusy(true);
    try {
      let assignmentId = src.assignment?.id ?? pendingAssignmentId;
      if (!assignmentId) {
        // Persist the exact intended primary key before contacting Supabase.
        // A lost HTTP response can never create a second assignment on retry.
        assignmentId = Crypto.randomUUID();
        const draft: Draft = {
          key, title: src.title, params: aid ? { aid } : { workout: workout! },
          client_id: clientId, started, log, timerResults, runnerClocks, timedSetClocks, restClock: restSnapshot,
          pendingAssignmentId: assignmentId,
        };
        // Fail closed: without a persisted ID we cannot safely retry after
        // an unknown network outcome.
        if (!writeDraftCore(storage, workoutDraftSlot(key), draft) ||
            !writeDraftPatch(storage, workoutDraftSlot(key), key, { pendingAssignmentId: assignmentId }))
          throw new Error('Cannot safely checkpoint this workout before saving');
        setPendingAssignmentId(assignmentId);
      }
      if (!src.assignment) {
        const expectedId = assignmentId;
        const getExisting = async () => {
          const existing = await sb.from('coach_assignments')
            .select('id, client_id, trainer_id, workout_id')
            .eq('id', expectedId).maybeSingle();
          if (existing.error) throw existing.error;
          if (!existing.data) return false;
          if (!matchesPendingAssignment(existing.data, expectedId, app.user!.id, clientId!, src.workoutId))
            throw new Error('Assignment ID belongs to a different workout or client');
          return true;
        };
        if (!(await getExisting())) {
          const { error: createError } = await sb.from('coach_assignments').insert({
            id: expectedId, trainer_id: app.user.id, client_id: clientId,
            workout_id: src.workoutId, scheduled_on: dayKey(new Date()),
            title: src.title, snapshot: src.blocks,
          });
          if (createError && createError.code !== '23505') throw createError;
          // Also handles duplicate PK and the case where the server inserted
          // the assignment but its response was lost.
          if (!(await getExisting())) throw new Error('Assignment creation not confirmed');
        }
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
      if (liveTimer.current) clearTimeout(liveTimer.current);
      rest.skip();
      hush();
      // Cleanup is scoped to this workout. Late native notifications must
      // not fire after its draft has been finalized.
      void clearWorkoutRestReminder(sessionId);
      void clearWorkoutLinkedReminders(sessionId, Object.keys(linkedTimers));
      clearDraft();
      toast('Workout saved. Nice work!');
      router.replace({ pathname: '/workout/[aid]', params: { aid: assignmentId!, done: '1' } });
    } catch (error) {
      toast(errText(error), false);
    } finally {
      saveInFlight.current = false;
      saveLocked.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: src.title, headerRight: () => <Txt v="bold" style={{ marginRight: 12, fontVariant: ['tabular-nums'] }}>{clock((now - started) / 1000)}</Txt> }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          {isTrainer && !src.assignment && (
            clientId ? (
              <Txt v="smallBold" color={p.focus}>Training {clients.find((c) => c.id === clientId)?.name ?? 'your client'}</Txt>
            ) : (
              // Only for a workout opened without a client (older links): pick once, then it's fixed
              <Card style={{ gap: 8 }}>
                <Txt v="bold">Who are you training?</Txt>
                {clients.length === 0 ? <Txt v="small">You need an active client to log a session.</Txt> : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {clients.map((c) => <Chip key={c.id} label={c.name} onPress={() => ask(`Training ${c.name}?`, 'The client can’t be changed once the workout starts.', [
                      { text: 'Cancel', style: 'cancel' }, { text: 'Start', onPress: () => setClientId(c.id) }])} />)}
                  </View>
                )}
              </Card>
            )
          )}
          {src.assignment?.trainer_note ? <Card><Txt v="smallBold" color={p.focus}>From your trainer</Txt><Txt>{src.assignment.trainer_note}</Txt></Card> : null}
          {src.blocks.filter((b) => b.kind === 'timed').map((b) => {
            if (b.kind !== 'timed') return null;
            const savedTimer = linkedTimers[b.id] ?? null;
            return savedTimer
              ? <LinkedLapisRunner key={timerInstanceKey(sessionId, b.id)} timer={savedTimer} reminderKey={lapisReminderKey(sessionId, b.id)}
                  screenFocused={activeScreen && !busy && !finishing}
                  canCue={() => isWorkoutSessionOwner(leaseToken.current)}
                  initialClock={runnerClocks[b.id]}
                  blocked={!canStartLinkedTimer({ linked: activeTimerId, timedSet: activeSetTimerKey }, b.id)}
                  onClockChange={(clock) => {
                    if (saved.current || saveLocked.current) return;
                    if (!activeScreen || currentRouteKey.current !== key) {
                      try {
                        const serialized = patchDraftClock(
                          loadWorkoutDraft(storage, key), key, b.id, clock,
                        );
                        if (serialized) storage.setItem(workoutDraftSlot(key), serialized);
                      } catch { /* in-memory runner remains available */ }
                    }
                    if (currentRouteKey.current === key)
                      setRunnerClocks((prev) => ({ ...prev, [b.id]: clock }));
                  }}
                  onStart={(freshRun) => {
                    if (!canMutateWorkoutTimer(key, currentRouteKey.current, saveLocked.current, saved.current)) return;
                    rest.pause();
                    setActiveTimerId(b.id);
                    if (freshRun) setTimerResults((prior) => clearTimerCompletion(prior, b.id));
                  }}
                  onPause={() => { if (canMutateWorkoutTimer(key, currentRouteKey.current, saveLocked.current, saved.current)) setActiveTimerId((current) => current === b.id ? null : current); }}
                  onReset={() => { if (canMutateWorkoutTimer(key, currentRouteKey.current, saveLocked.current, saved.current)) setTimerResults((prior) => clearTimerCompletion(prior, b.id)); }}
                  onComplete={(actualSeconds) => {
                    if (!canMutateWorkoutTimer(key, currentRouteKey.current, saveLocked.current, saved.current)) return;
                    setActiveTimerId((current) => current === b.id ? null : current);
                    const result: LapisTimerResult = {
                      block_id: b.id, timer_id: savedTimer.id, name: savedTimer.name,
                      planned_seconds: lapisTimerSeconds(savedTimer), actual_seconds: Math.round(actualSeconds),
                      completed_at: new Date().toISOString(),
                    };
                    setTimerResults((prior) => recordTimerCompletion(prior, result));
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
                  <Pressable accessibilityRole="button" accessibilityLabel={`${e.ex?.name ?? 'Exercise'} details`} onPress={() => e.ex && setInfo(e.ex)}><ExerciseThumb img={e.ex?.img} video={e.ex?.video} size={52} ex={e.ex ? byRef(`${e.ex.src}:${e.ex.id}`) ?? { name: e.ex.name } : null} /></Pressable>
                  <View style={{ flex: 1 }}>
                    <Txt v="h3">{e.ex?.name ?? 'Exercise'}</Txt>
                    {e.swapped_from ? <Txt v="small">Instead of {e.swapped_from}</Txt> : null}
                  </View>
                  {hist.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`${e.ex?.name ?? 'Exercise'} history`} hitSlop={8} onPress={() => setHistoryFor(bi)}><Icon name="history" color={p.focus} /></Pressable>}
                  {e.ex && <Button small kind="quiet" icon="swap_horiz" title="Swap" onPress={() => setSwapping(bi)} />}
                </View>
                {b?.note ? <Txt v="small">{b.note}</Txt> : null}
                {(() => {
                  const libEx = e.ex ? byRef(`${e.ex.src}:${e.ex.id}`) : undefined;
                  const fields = settingFields(libEx ?? (e.ex ? { name: e.ex.name } : null));
                  // Equipment with adjustments gets its slots; your own exercises can add any; bodyweight moves show nothing
                  if (!fields.length && !Object.keys(e.settings ?? {}).length && e.ex?.src !== 'my') return null;
                  return <EquipmentSettings fields={fields} value={e.settings}
                    onChange={(v) => setLog((l) => l.map((x, n) => (n === bi ? { ...x, settings: cleanSettings(v) ?? {} } : x)))} />;
                })()}
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
                        return <SetTimer key={timerInstanceKey(sessionId, k)} label={`set ${si + 1}${who}`} target={s[tk] ?? null} compact={!!side} go={autoGo?.key === k ? autoGo.n : undefined}
                          blocked={!canStartTimedSet({ linked: activeTimerId, timedSet: activeSetTimerKey }, k)}
                          screenFocused={activeScreen && !busy && !finishing}
                          canCue={() => isWorkoutSessionOwner(leaseToken.current)}
                          initialClock={timedSetClocks[k]}
                          onClockChange={(next) => {
                            if (saved.current || saveLocked.current) return;
                            if (!activeScreen || currentRouteKey.current !== key) {
                              try {
                                const serialized = patchDraftTimedSetClock(
                                  loadWorkoutDraft(storage, key), key, k, next,
                                );
                                if (serialized) storage.setItem(workoutDraftSlot(key), serialized);
                              } catch { /* keep in-memory progress */ }
                            }
                            if (currentRouteKey.current === key)
                              setTimedSetClocks((prior) => ({ ...prior, [k]: next }));
                          }}
                          onRunningChange={(running) => {
                            if (!canMutateWorkoutTimer(key, currentRouteKey.current, saveLocked.current, saved.current)) return;
                            if (running) rest.pause();
                            setActiveSetTimerKey((current) => running ? k : current === k ? null : current);
                          }}
                          onDone={(sec) => {
                            if (!canMutateWorkoutTimer(key, currentRouteKey.current, saveLocked.current, saved.current)) return;
                            const completionKey = `${k}:${started}`;
                            if (s.done || completedSetEvents.current.has(completionKey) ||
                                !shouldAcceptTimedSetCompletion(false, sec)) return;
                            completedSetEvents.current.add(completionKey);
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
            { text: 'Discard', style: 'destructive', onPress: () => {
              if (saveInFlight.current) return;
              saved.current = true;
              saveLocked.current = true;
              rest.skip();
              hush();
              void clearWorkoutRestReminder(sessionId);
              void clearWorkoutLinkedReminders(sessionId, Object.keys(linkedTimers));
              clearDraft();
              if (liveTimer.current) clearTimeout(liveTimer.current);
              void dropLiveWorkout(aid ? { aid } : {}).catch(() => {});
              router.back();
            } }])} />
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, alignItems: 'center', gap: 10 }} pointerEvents="box-none">
        <RestBar t={rest} blocked={!activeScreen || !canResumeRest({ linked: activeTimerId, timedSet: activeSetTimerKey })} />
        <Button kind="accent" title="Finish workout" icon="check" onPress={() => {
          if (!activeScreen) return;
          if (timersActive) return toast('Pause or finish active timers before completing this workout', false);
          if (done || timerResults.length) {
            rest.pause(); // A pending rest cannot auto-start a set under the finish sheet.
            setAutoGo(null);
            setFinishing(true);
          }
          else toast('Complete an exercise set or Lapis timer first', false);
        }} />
      </View>

      <SwapSheet entry={swapping !== null ? log[swapping] : null} trainerId={src.assignment?.trainer_id ?? app.trainer?.user_id} onClose={() => setSwapping(null)} past={past}
        workoutTitle={isTrainer && src.workoutId ? src.title : null}
        onSwap={(alt, forGood) => {
          const i = swapping!; const entry = log[i];
          setLog((l) => l.map((x, n) => (n === i ? { ...x, ex: refOf(alt), settings: lastSettings(historyOf(past, exKey(refOf(alt)))), swapped_from: x.swapped_from ?? x.ex?.name, swapped_from_ref: x.swapped_from_ref ?? (x.ex ? `${x.ex.src}:${x.ex.id}` : undefined) } : x)));
          setSwapping(null);
          if (forGood && entry?.ex) void swapForGood(entry.block_id, entry.ex, refOf(alt));
        }} />
      <ExerciseHistory entry={historyFor !== null ? log[historyFor] : null} history={historyFor !== null ? historyOf(past, exKey(log[historyFor]?.ex)) : []} onClose={() => setHistoryFor(null)} />
      <ExerciseInfo ex={info ? { name: info.name, ref: `${info.src}:${info.id}`, img: info.img, video: info.video } : null} onClose={() => setInfo(null)} screen="session" />
      <Sheet visible={finishing} onClose={() => setFinishing(false)} title="How did that feel?">
        <Txt v="small" style={{ marginBottom: 8 }}>Effort, from 1 (easy) to 10 (all-out). Optional.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <Chip key={n} label={String(n)} selected={rpe === n} onPress={() => setRpe(rpe === n ? null : n)} />)}
        </View>
        <Field label="Notes" hint="(optional)" value={note} onChangeText={setNote} multiline placeholder="Felt strong, left knee a bit sore" />
        <Txt v="small" style={{ marginBottom: 12 }}>{done} of {total} sets · {timerResults.length} Lapis timers · {clock((now - started) / 1000)}</Txt>
        <Button title="Save workout" busy={busy} disabled={timersActive} onPress={save} style={{ alignSelf: 'flex-start' }} />
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

/** Swap an exercise mid-workout: the trainer's chosen alternatives first, then similar moves from the library. A trainer can
 *  also make the swap permanent in the workout (and this client's upcoming sessions of it). */
function SwapSheet({ entry, trainerId, workoutTitle, past, onClose, onSwap }: {
  entry: LogEntry | null; trainerId?: string; workoutTitle: string | null; past: PastLog[]; onClose: () => void; onSwap: (e: LibExercise, forGood: boolean) => void;
}) {
  const p = usePalette();
  const { mine } = useMyExercises(entry ? trainerId : undefined);
  const [hidden] = useHidden();
  const [forGood, setForGood] = useState(false);
  useEffect(() => { setForGood(false); }, [entry]);
  // What to swap from: the exercise as prescribed (even if it was already swapped once today)
  const fromRef = entry?.swapped_from_ref ?? (entry?.ex ? `${entry.ex.src}:${entry.ex.id}` : '');
  const fromName = entry?.swapped_from ?? entry?.ex?.name ?? '';
  const current = fromRef ? byRef(fromRef, mine) : undefined;
  const [popular, setPopular] = useState<{ ref: string; uses: number }[]>([]);
  useEffect(() => {
    setPopular([]);
    if (!fromRef.startsWith('lib:')) return;
    sb.rpc('coach_popular_swaps', { from_ref: fromRef, from_name: fromName, max_rows: 8 }).then(({ data }) => setPopular((data as { ref: string; uses: number }[] | null) ?? []));
  }, [fromRef, fromName]);
  // Sections, each without repeats: this person's usual swaps, what everyone swaps to, then similar moves (trainer's picks first)
  const seen = new Set<string>([entry?.ex ? `${entry.ex.src}:${entry.ex.id}` : '', fromRef]);
  const take = (list: { ref: string; uses?: number }[], n: number) => list.map((x) => ({ e: byRef(x.ref, mine), uses: x.uses }))
    .filter((x): x is { e: LibExercise; uses: number | undefined } => !!x.e && !hidden.has(x.e.ref) && !seen.has(x.e.ref) && (seen.add(x.e.ref), true)).slice(0, n);
  const yours = entry ? take(pastSwaps(past, fromRef, fromName), 4) : [];
  const common = take(popular, 4);
  const similar = current ? take(alternativesFor(current, mine, 14).map((e) => ({ ref: e.ref })), 6) : [];
  const options = [...yours.map((x) => ({ ...x, why: `You’ve used it ${x.uses} time${x.uses === 1 ? '' : 's'}` })),
    ...common.map((x) => ({ ...x, why: `A common swap · used ${x.uses} time${x.uses === 1 ? '' : 's'}` })),
    ...similar.map((x) => ({ ...x, why: '' }))];
  const chosen = new Set(current?.alts ?? []);
  return (
    <Sheet visible={!!entry} onClose={onClose} title={`Swap ${entry?.ex?.name ?? 'exercise'}`}>
      {options.length === 0 && <Txt>No alternatives for this one.</Txt>}
      {options.map(({ e, why }, i) => (
        <View key={e.ref}>
          {(i === 0 || (i === yours.length && yours.length) || (i === yours.length + common.length && (yours.length || common.length))) ? (
            <Txt v="kicker" color={p.muted} style={{ textTransform: 'uppercase', marginTop: i ? 14 : 0, marginBottom: 2 }}>
              {i < yours.length ? 'Your usual swaps' : i < yours.length + common.length ? 'What people swap to' : 'Similar moves'}
            </Txt>
          ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Swap to ${e.name}`} onPress={() => onSwap(e, forGood)}
          style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.line, opacity: pressed ? 0.6 : 1 })}>
          <ExerciseThumb img={e.images[0]} video={e.video} size={52} ex={e} />
          <View style={{ flex: 1 }}>
            <Txt v="bold">{e.name}</Txt>
            <Txt v="small">{[chosen.has(e.ref) ? 'Picked by your trainer' : null, why || null, titleCase(e.equipment)].filter(Boolean).join(' · ')}</Txt>
          </View>
          <Icon name="swap_horiz" color={p.focus} />
        </Pressable>
        </View>
      ))}
      {workoutTitle && <View style={{ marginTop: 8 }}><Toggle label={`Change it in “${workoutTitle}” for good`} value={forGood} onChange={setForGood}
        sub="Leave off to swap just for today (equipment taken). On: the workout and this client's upcoming sessions of it use the new exercise from now on." /></View>}
      <Txt v="small" style={{ marginTop: 10 }}>{workoutTitle ? 'Sets and numbers stay the same.' : 'Your sets and numbers stay the same; your trainer sees what you swapped.'}</Txt>
    </Sheet>
  );
}
