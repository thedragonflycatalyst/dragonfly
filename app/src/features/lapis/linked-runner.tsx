import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { Button, Txt } from '@/components/ui';
import { fmtSeconds } from '@/lib/workouts';
import { F, R, usePalette } from '@/lib/theme';
import { bell, buzz, hush, say } from './audio';
import { type LapisTimer } from './library';
import { compileLapisTimeline, phaseAt } from './timeline';
import { elapsedAt, freshClock, pauseClock, skipClock, startClock, validClock, type RunnerClock } from './runner-clock';
import { reconcileLapisCompletion, clearLapisCompletion } from './background';
import { compileSpokenCues, cuesCrossed } from './cue-plan';
import { completedNaturally, phaseTransitionDue } from './runner-events';
import { announcementForPhase } from './phase-announcement';
import { reminderSeconds } from './reminder-policy';
import { pauseForNavigation } from './navigation-recovery';

/** Foreground interval controls using absolute clock offsets.
 * If the app is suspended, the phase catches up to actual elapsed time when
 * React Native resumes. This does not promise continuous background audio.
 */
export function LinkedLapisRunner({
  timer, reminderKey, onComplete, onReset, onStart, onPause, blocked = false, screenFocused = true, canCue, initialClock, onClockChange,
}: {
  timer: LapisTimer;
  reminderKey: string;
  onComplete?: (actualSeconds: number) => void;
  onReset?: () => void;
  onStart?: (freshRun: boolean) => void;
  onPause?: () => void;
  blocked?: boolean;
  screenFocused?: boolean;
  canCue?: () => boolean;
  initialClock?: RunnerClock;
  onClockChange?: (clock: RunnerClock) => void;
}) {
  const p = usePalette();
  const timeline = useMemo(() => compileLapisTimeline(timer), [timer.template]);
  const spokenCues = useMemo(() => compileSpokenCues(timer, timeline), [timer.template, timeline]);
  const [clock, setClock] = useState<RunnerClock>(() => validClock(initialClock ?? freshClock(), timeline.totalSeconds));
  const [now, setNow] = useState(Date.now());
  const [muted, setMuted] = useState(false);
  const lastPhase = useRef<number | null>(null);
  const foreground = useRef(AppState.currentState === 'active');
  const explicitlyStarted = useRef(false);
  const lastCuePosition = useRef<number | null>(null);
  const reported = useRef(false);
  const changeRef = useRef(onClockChange);
  changeRef.current = onClockChange;
  // Save on every control change, not every 200ms display tick.
  useEffect(() => { changeRef.current?.(clock); }, [clock]);
  const elapsed = elapsedAt(clock, now, timeline.totalSeconds);
  const { since, hasStarted, skipped } = clock;
  const state = phaseAt(timeline, elapsed);
  const phaseIndex = state.phase ? timeline.phases.indexOf(state.phase) : timeline.phases.length;
  const done = hasStarted && state.finished;

  // On route blur, freeze the running clock and report the paused snapshot
  // synchronously. Navigation is not an OS background interruption: it should
  // never silently complete a workout after the screen is left.
  useEffect(() => {
    if (screenFocused || clock.since === null) return;
    const paused = pauseForNavigation(clock, Date.now(), timeline.totalSeconds);
    changeRef.current?.(paused);
    setClock(paused);
    onPause?.();
  }, [screenFocused, clock, timeline.totalSeconds, onPause]);

  // A workout may contain several Lapis blocks, but only one linked timer
  // can actively run and own voice/haptics at any moment.
  useEffect(() => {
    if (blocked && clock.since !== null) {
      setClock((old) => pauseClock(old, Date.now(), timeline.totalSeconds));
    }
  }, [blocked, clock.since, timeline.totalSeconds]);

  // Reconcile a single tagged native completion reminder. This effect runs
  // on clock control changes, not on display ticks. A per-key serialized queue
  // ensures an earlier schedule cannot outlive a later reset or pause.
  useEffect(() => {
    const reconcile = (state: string | null | undefined) => {
      const left = screenFocused ? reminderSeconds(state, clock, timeline.totalSeconds, blocked, Date.now()) : null;
      void reconcileLapisCompletion(reminderKey, left, timer.name);
    };
    const sub = AppState.addEventListener('change', reconcile);
    reconcile(AppState.currentState);
    return () => { sub.remove(); void clearLapisCompletion(reminderKey); };
  }, [blocked, screenFocused, clock, timeline.totalSeconds, timer.name, reminderKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      foreground.current = state === 'active';
      if (state !== 'active' && clock.since !== null && !blocked && screenFocused && (canCue?.() ?? true)) hush();
      // On wake, reconcile elapsed time immediately; don't replay missed cues.
      lastCuePosition.current = null;
      setNow(Date.now());
    });
    return () => subscription.remove();
  }, [clock.since, blocked, screenFocused, canCue]);

  useEffect(() => {
    if (since == null) return;
    const handle = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(handle);
  }, [since]);

  useEffect(() => {
    if (since == null || muted || blocked || !screenFocused || !(canCue?.() ?? true) || !hasStarted) return;
    const previous = lastPhase.current;
    const fresh = explicitlyStarted.current;
    lastPhase.current = phaseIndex;
    explicitlyStarted.current = false;
    if (!foreground.current) return;
    if (done) {
      // A late background completion is handled by the native notification.
      // Don't ring again on foreground restoration.
      return;
    }
    if (!phaseTransitionDue(timeline, previous, phaseIndex, elapsed, true, fresh)) return;
    const phase = state.phase;
    if (!phase) return;
    const announcement = announcementForPhase(phase, timer);
    if (announcement.ring) void bell();
    if (announcement.speech) void say(announcement.speech);
    buzz();
  }, [phaseIndex, since, muted, blocked, screenFocused, hasStarted, done, elapsed, timeline, timer]);

  // Only announce cues crossed during foreground playback. Reopening a
  // suspended app must not replay a burst of overdue announcements.
  useEffect(() => {
    if (since == null || muted || blocked || !screenFocused || !(canCue?.() ?? true) || !foreground.current) { lastCuePosition.current = elapsed; return; }
    const before = lastCuePosition.current ?? elapsed;
    lastCuePosition.current = elapsed;
    const cues = cuesCrossed(spokenCues, before, elapsed);
    for (const cue of cues) {
      if (cue.kind === 'countdown') buzz();
      void say(cue.text);
    }
  }, [elapsed, since, muted, blocked, screenFocused, spokenCues]);

  useEffect(() => {
    if (!done || reported.current) return;
    reported.current = true;
    // A completed timeline cannot remain "running" in the persisted draft.
    // Otherwise a successfully finished interval would block workout saving.
    if (clock.since !== null) {
      setClock((previous) => pauseClock(previous, Date.now(), timeline.totalSeconds));
    }
    if (completedNaturally(hasStarted, skipped, elapsed, timeline.totalSeconds)) {
      onComplete?.(Math.round(elapsed));
    } else {
      // A skipped run isn't logged, but must release the audio lease.
      onPause?.();
    }
  }, [done, clock.since, hasStarted, skipped, elapsed, timeline.totalSeconds, onComplete, onPause]);

  const pause = () => {
    if (canCue?.() ?? true) hush();
    setClock((old) => pauseClock(old, Date.now(), timeline.totalSeconds));
    onPause?.();
  };
  const start = () => {
    if (blocked || !screenFocused || !(canCue?.() ?? true)) return;
    onStart?.(!hasStarted || state.finished); // Resume only claims ownership; a new run invalidates old results.
    if (!hasStarted || state.finished) { lastCuePosition.current = -0.01; explicitlyStarted.current = true; }
    if (state.finished) { lastPhase.current = null; reported.current = false; }
    const tick = Date.now();
    setNow(tick);
    setClock((old) => startClock(old, tick, timeline.totalSeconds));
  };
  const reset = () => {
    if (clock.since !== null && (canCue?.() ?? true)) hush();
    setClock(freshClock()); setNow(Date.now());
    reported.current = false; lastPhase.current = null; lastCuePosition.current = null; explicitlyStarted.current = false;
    onPause?.();
    onReset?.();
  };
  const skip = () => {
    if (!state.phase || !(canCue?.() ?? true)) return;
    hush();
    const tick = Date.now();
    setClock((old) => skipClock(old, tick, state.phase!.endAt));
    setNow(tick);
    lastPhase.current = phaseIndex; lastCuePosition.current = state.phase.endAt;
    explicitlyStarted.current = false;
  };
  const remaining = Math.ceil(state.left);
  const total = timeline.totalSeconds;
  const percent = total > 0 ? Math.min(100, elapsed / total * 100) : 100;
  return (
    <View style={{ gap: 10, padding: 14, backgroundColor: p.surface, borderRadius: R.lg, borderWidth: 1.5, borderColor: p.line }}>
      <Txt v="kicker" color={p.focus}>Lapis interval session</Txt>
      <Txt v="h3">{timer.name}</Txt>
      {blocked && !done ? <Txt v="small" color={p.muted}>Pause the other Lapis timer before starting this one.</Txt> : null}
      <Txt v="small" color={p.muted}>{done ? (skipped ? 'Finished with skipped intervals — restart to log a complete run' : 'Complete') : !hasStarted ? 'Ready to start' : since === null ? 'Paused' :
        state.phase?.kind === 'work' ? 'Work' : state.phase?.name ?? 'Rest'}</Txt>
      <Txt accessibilityRole="timer" accessibilityLabel={`${remaining} seconds remaining`}
        style={{ fontFamily: F.display, fontSize: 44, textAlign: 'center', color: p.ink, fontVariant: ['tabular-nums'] }}>
        {fmtSeconds(remaining)}
      </Txt>
      <View style={{ width: '100%', height: 8, borderRadius: 4, backgroundColor: p.soft, overflow: 'hidden' }}>
        <View style={{ width: `${percent}%`, height: '100%', backgroundColor: p.focus }} />
      </View>
      <Txt v="small" color={p.muted}>{state.phase?.round ? `Round ${state.phase.round} of ${timer.rounds} · Cycle ${state.phase.cycle} of ${timer.cycles}` : ''}
        {total ? ` · ${fmtSeconds(Math.ceil(total - elapsed))} remaining overall` : ''}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {since === null && !done ? <Button small title={hasStarted ? 'Resume' : 'Start'} icon="play_arrow" disabled={blocked || !screenFocused} onPress={start} /> :
          !done && <Button small title="Pause" icon="pause" onPress={pause} />}
        {!done && hasStarted && <Button small kind="ghost" title="Skip interval" icon="skip_next" onPress={skip} />}
        {hasStarted && <Button small kind="ghost" title="Reset" icon="replay" onPress={reset} />}
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Enable timer cues' : 'Mute timer cues'} onPress={() => setMuted(!muted)}
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
          <Txt v="smallBold" color={p.focus}>{muted ? 'Unmute cues' : 'Mute cues'}</Txt>
        </Pressable>
      </View>
      <Txt v="small" color={p.muted}>Timers resume from elapsed time when you return to the app. Reliable announcements while the app is backgrounded require additional platform integration.</Txt>
    </View>
  );
}
