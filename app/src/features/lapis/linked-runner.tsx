import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { Button, Txt } from '@/components/ui';
import { fmtSeconds } from '@/lib/workouts';
import { F, R, usePalette } from '@/lib/theme';
import { bell, buzz, say } from './audio';
import { type LapisTimer } from './library';
import { compileLapisTimeline, phaseAt } from './timeline';
import { elapsedAt, freshClock, pauseClock, skipClock, startClock, validClock, type RunnerClock } from './runner-clock';
import { scheduleLapisCompletion, cancelLapisCompletion } from './background';
import { compileSpokenCues, cuesCrossed } from './cue-plan';

/** Foreground interval controls using absolute clock offsets.
 * If the app is suspended, the phase catches up to actual elapsed time when
 * React Native resumes. This does not promise continuous background audio.
 */
export function LinkedLapisRunner({
  timer, onComplete, onReset, onStart, initialClock, onClockChange,
}: {
  timer: LapisTimer;
  onComplete?: (actualSeconds: number) => void;
  onReset?: () => void;
  onStart?: () => void;
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

  // Native end-of-timer fallback while backgrounded. React timers and voice
  // announcements aren't guaranteed to run after the OS suspends the app.
  useEffect(() => {
    let generation = 0;
    let pending: string | null = null;
    const change = async (state: string) => {
      const token = ++generation;
      const previous = pending;
      pending = null;
      await cancelLapisCompletion(previous);
      if (state === 'active' || clock.since == null || clock.skipped) return;
      const left = timeline.totalSeconds - elapsedAt(clock, Date.now(), timeline.totalSeconds);
      if (left <= 0) return;
      const id = await scheduleLapisCompletion(left, timer.name);
      if (generation === token) pending = id;
      else await cancelLapisCompletion(id);
    };
    const sub = AppState.addEventListener('change', (state) => { void change(state); });
    void change(AppState.currentState);
    return () => {
      generation++;
      sub.remove();
      void cancelLapisCompletion(pending);
    };
  }, [clock, timeline.totalSeconds, timer.name]);

  useEffect(() => {
    if (since == null) return;
    const handle = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(handle);
  }, [since]);

  useEffect(() => {
    if (since == null || muted || !hasStarted) return;
    if (lastPhase.current === phaseIndex) return;
    lastPhase.current = phaseIndex;
    if (done) { void bell(); void say('Time'); return; }
    if (!state.phase) return;
    if (state.phase.kind === 'work') {
      void bell();
      void say(state.phase.name);
    } else if (state.phase.kind === 'rest' || state.phase.kind === 'cycleRest') {
      void say('Rest');
    } else if (state.phase.kind === 'prepare') {
      void say('Prepare');
    } else if (state.phase.kind === 'cooldown') {
      void say('Cooldown');
    }
    buzz();
  }, [phaseIndex, since, muted, hasStarted, done, state.phase?.kind, state.phase?.name]);

  // Only announce cues crossed during foreground playback. Reopening a
  // suspended app must not replay a burst of overdue announcements.
  useEffect(() => {
    if (since == null || muted) { lastCuePosition.current = elapsed; return; }
    const before = lastCuePosition.current ?? elapsed;
    lastCuePosition.current = elapsed;
    const cues = cuesCrossed(spokenCues, before, elapsed);
    for (const cue of cues) {
      if (cue.kind === 'countdown') buzz();
      void say(cue.text);
    }
  }, [elapsed, since, muted, spokenCues]);

  useEffect(() => {
    if (done && !reported.current) {
      reported.current = true;
      if (!skipped) onComplete?.(Math.round(elapsed));
    }
  }, [done, elapsed, onComplete, skipped]);

  const pause = () => setClock((old) => pauseClock(old, Date.now(), timeline.totalSeconds));
  const start = () => {
    if (!hasStarted || state.finished) { onStart?.(); lastCuePosition.current = -0.01; }
    if (state.finished) { lastPhase.current = null; reported.current = false; }
    const tick = Date.now();
    setNow(tick);
    setClock((old) => startClock(old, tick, timeline.totalSeconds));
  };
  const reset = () => {
    setClock(freshClock()); setNow(Date.now());
    reported.current = false; lastPhase.current = null; lastCuePosition.current = null;
    onReset?.();
  };
  const skip = () => {
    if (!state.phase) return;
    const tick = Date.now();
    setClock((old) => skipClock(old, tick, state.phase!.endAt));
    setNow(tick);
    lastPhase.current = null; lastCuePosition.current = state.phase.endAt;
  };
  const remaining = Math.ceil(state.left);
  const total = timeline.totalSeconds;
  const percent = total > 0 ? Math.min(100, elapsed / total * 100) : 100;
  return (
    <View style={{ gap: 10, padding: 14, backgroundColor: p.surface, borderRadius: R.lg, borderWidth: 1.5, borderColor: p.line }}>
      <Txt v="kicker" color={p.focus}>Lapis interval session</Txt>
      <Txt v="h3">{timer.name}</Txt>
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
        {since === null && !done ? <Button small title={hasStarted ? 'Resume' : 'Start'} icon="play_arrow" onPress={start} /> :
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
