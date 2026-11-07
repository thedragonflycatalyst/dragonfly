import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Txt } from '@/components/ui';
import { fmtSeconds } from '@/lib/workouts';
import { F, R, usePalette } from '@/lib/theme';
import { bell, buzz, say } from './audio';
import { type LapisTimer } from './library';
import { compileLapisTimeline, phaseAt } from './timeline';

/** Foreground interval controls using absolute clock offsets.
 * If the app is suspended, the phase catches up to actual elapsed time when
 * React Native resumes. This does not promise continuous background audio.
 */
export function LinkedLapisRunner({ timer }: { timer: LapisTimer }) {
  const p = usePalette();
  const timeline = compileLapisTimeline(timer);
  const [elapsedBefore, setElapsedBefore] = useState(0);
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [hasStarted, setHasStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const lastPhase = useRef<number | null>(null);
  const elapsed = Math.min(timeline.totalSeconds, elapsedBefore + (since === null ? 0 : Math.max(0, now - since) / 1000));
  const state = phaseAt(timeline, elapsed);
  const phaseIndex = state.phase ? timeline.phases.indexOf(state.phase) : timeline.phases.length;
  const done = hasStarted && state.finished;

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

  const pause = () => { setElapsedBefore(elapsed); setSince(null); };
  const start = () => {
    if (state.finished) { setElapsedBefore(0); lastPhase.current = null; }
    setHasStarted(true); setNow(Date.now()); setSince(Date.now());
  };
  const reset = () => {
    setSince(null); setElapsedBefore(0); setNow(Date.now());
    setHasStarted(false); lastPhase.current = null;
  };
  const skip = () => {
    if (!state.phase) return;
    setElapsedBefore(state.phase.endAt);
    setNow(Date.now());
    if (since != null) setSince(Date.now());
    lastPhase.current = null;
  };
  const remaining = Math.ceil(state.left);
  const total = timeline.totalSeconds;
  const percent = total > 0 ? Math.min(100, elapsed / total * 100) : 100;
  return (
    <View style={{ gap: 10, padding: 14, backgroundColor: p.surface, borderRadius: R.lg, borderWidth: 1.5, borderColor: p.line }}>
      <Txt v="kicker" color={p.focus}>Lapis interval session</Txt>
      <Txt v="h3">{timer.name}</Txt>
      <Txt v="small" color={p.muted}>{done ? 'Complete' : !hasStarted ? 'Ready to start' : since === null ? 'Paused' :
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
