// Lapis inside a workout: the rest timer that starts when a set is ticked, and the mini timer for timed sets
// (sprints, carries, planks). Cues follow the person's Lapis settings: voice, music mode, bell, vibration.
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { Icon, Txt } from '@/components/ui';
import { clock } from '@/lib/session';
import { F, R, usePalette } from '@/lib/theme';
import { bell, buzz, say } from './audio';
import { getPrefs } from './prefs';
import { elapsedTimedSet, pauseTimedSet, resetTimedSet, restoreTimedSetClock, resumeTimedSet, type TimedSetClock } from './timed-set-clock';

/* ---------- the backstop if the phone stops the app while locked ---------- */
let pending: string | null = null;
async function backstop(at: number | null, body = 'Rest is over. Next set!') {
  if (Platform.OS === 'web') return;
  try {
    const N = await import('expo-notifications');
    if (pending) { await N.cancelScheduledNotificationAsync(pending).catch(() => {}); pending = null; }
    if (at == null) return;
    const secs = Math.round((at - Date.now()) / 1000) + 2; // a moment after the app's own bell, so only one rings
    if (secs < 2) return;
    if (Platform.OS === 'android') await N.setNotificationChannelAsync('rest', { name: 'Rest timer', importance: N.AndroidImportance.HIGH, sound: 'bell_ring2.wav', vibrationPattern: [0, 250, 120, 250] });
    pending = await N.scheduleNotificationAsync({
      content: { title: 'Dragonfly', body, sound: 'bell_ring2.wav', data: { kind: 'rest' } },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secs, channelId: 'rest' },
    });
  } catch { /* notifications off: the in-app timer still runs */ }
}

export type Rest = { until: number; total: number; label: string; pausedLeft: number | null };

/** Rest timer state and cues: "Rest" at the start, optional "Halfway", 3-2-1, then the bell. */
export function useRest() {
  const [rest, setRest] = useState<Rest | null>(null);
  const [, setNow] = useState(Date.now());
  const fired = useRef(new Set<string>());
  const restRef = useRef(rest); restRef.current = rest;
  const onEnd = useRef<(() => void) | null>(null);

  const on = !!rest && rest.pausedLeft == null;
  useEffect(() => { if (!on) return; const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, [on]);
  // Locked or switched away: set the backstop; back in the app: clear it
  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => {
      const r = restRef.current;
      if (st === 'active') void backstop(null);
      else if (r && r.pausedLeft == null) void backstop(r.until, r.label ? `Rest is over. ${r.label}` : undefined);
    });
    return () => { s.remove(); void backstop(null); };
  }, []);

  const left = rest ? (rest.pausedLeft ?? Math.max(0, (rest.until - Date.now()) / 1000)) : 0;
  useEffect(() => {
    if (!rest || rest.pausedLeft != null) return;
    const p = getPrefs(), f = fired.current, s = Math.ceil(left);
    if (p.halfway && rest.total >= 20 && left <= rest.total / 2 && !f.has('half')) { f.add('half'); void say('Halfway'); }
    if (p.countdown) for (const n of [3, 2, 1]) if (s === n && rest.total > n && !f.has(String(n))) { f.add(String(n)); buzz(); void say(String(n)); }
    if (left <= 0 && !f.has('end')) {
      f.add('end'); void backstop(null); void bell(); setRest(null);
      const next = onEnd.current; onEnd.current = null; next?.();
    }
  }, [rest, left]);

  /** Start resting; `then` runs when the rest runs out (not when skipped), e.g. to start the next timed set */
  const start = (seconds: number, label = '', then?: () => void) => {
    onEnd.current = then ?? null;
    if (seconds <= 0) { then?.(); return; }
    fired.current = new Set();
    setRest({ until: Date.now() + seconds * 1000, total: seconds, label, pausedLeft: null });
    buzz();
    if (getPrefs().sayRest) void say('Rest');
    if (AppState.currentState !== 'active') void backstop(Date.now() + seconds * 1000);
  };
  const add = (sec: number) => setRest((r) => {
    if (!r) return r;
    if (r.pausedLeft != null) return { ...r, pausedLeft: Math.max(1, r.pausedLeft + sec), total: Math.max(1, r.total + sec) };
    const until = Math.max(Date.now() + 1000, r.until + sec * 1000);
    for (const k of ['3', '2', '1', 'half']) fired.current.delete(k);
    return { ...r, until, total: Math.max(1, r.total + sec) };
  });
  const pause = () => {
    void backstop(null);
    setRest((r) => (r && r.pausedLeft == null ? { ...r, pausedLeft: Math.max(0, (r.until - Date.now()) / 1000) } : r));
  };
  const resume = () => setRest((r) => {
    if (!r || r.pausedLeft == null) return r;
    const until = Date.now() + r.pausedLeft * 1000;
    if (AppState.currentState !== 'active') void backstop(until, r.label ? `Rest is over. ${r.label}` : undefined);
    return { ...r, until, pausedLeft: null };
  });
  const skip = () => { void backstop(null); setRest(null); onEnd.current = null; };
  return { rest, left, start, add, pause, resume, skip };
}

/** The Lapis rest bar pinned to the bottom of the workout */
export function RestBar({ t, blocked = false }: { t: ReturnType<typeof useRest>; blocked?: boolean }) {
  const p = usePalette();
  if (!t.rest) return null;
  const frac = t.rest.total ? Math.min(1, t.left / t.rest.total) : 0;
  const paused = t.rest.pausedLeft != null;
  const resumeBlocked = blocked && paused;
  const btn = { width: 44, height: 44, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: p.soft };
  return (
    <View accessibilityRole="timer" accessibilityLabel={`Rest, ${Math.ceil(t.left)} seconds left`}
      style={{ width: '100%', maxWidth: 560, borderRadius: R.lg, overflow: 'hidden', backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.focus }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${frac * 100}%`, backgroundColor: p.glow }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 }}>
        <View style={{ flex: 1, paddingLeft: 6 }}>
          <Txt v="kicker" color={p.focus} style={{ textTransform: 'uppercase' }}>{paused ? (blocked ? 'Paused for Lapis' : 'Paused') : 'Rest'}{t.rest.label ? ` · ${t.rest.label}` : ''}</Txt>
          <Txt style={{ fontFamily: F.display, fontSize: 34, fontVariant: ['tabular-nums'], color: p.ink }}>{clock(Math.ceil(t.left))}</Txt>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="15 seconds less" onPress={() => t.add(-15)} style={btn}><Txt v="smallBold" color={p.ink}>−15</Txt></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="15 seconds more" onPress={() => t.add(15)} style={btn}><Txt v="smallBold" color={p.ink}>+15</Txt></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={resumeBlocked ? 'Pause Lapis to resume rest' : paused ? 'Resume rest' : 'Pause rest'} disabled={resumeBlocked} onPress={paused ? t.resume : t.pause} style={[btn, resumeBlocked && { opacity: 0.4 }]}><Icon name={paused ? 'play_arrow' : 'pause'} color={p.ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip rest" onPress={t.skip} style={[btn, { backgroundColor: p.focus }]}><Icon name="skip_next" color={p.onAccent} /></Pressable>
      </View>
    </View>
  );
}

/**
 * Mini Lapis timer for a timed set, sitting where the time box goes. With a target it counts down ("Go", bell,
 * 3-2-1, bell); without one it's a stopwatch. When it ends it hands back the seconds done.
 */
export function SetTimer({
  target, onDone, label, compact, go: autoGo, blocked = false,
  screenFocused = true, onRunningChange, initialClock, onClockChange,
}: {
  target: number | null;
  onDone: (seconds: number) => void;
  label: string;
  compact?: boolean;
  go?: number;
  blocked?: boolean;
  screenFocused?: boolean;
  onRunningChange?: (running: boolean) => void;
  initialClock?: TimedSetClock;
  onClockChange?: (clock: TimedSetClock) => void;
}) {
  const p = usePalette();
  const [clockState, setClockState] = useState<TimedSetClock>(() =>
    restoreTimedSetClock(initialClock, target, Date.now()));
  const stateRef = useRef(clockState);
  stateRef.current = clockState;
  const callbacks = useRef({ onDone, onRunningChange, onClockChange });
  callbacks.current = { onDone, onRunningChange, onClockChange };
  const runningRef = useRef(false);
  const finished = useRef(false);
  const [now, setNow] = useState(Date.now());
  const fired = useRef(new Set<string>());
  const running = clockState.since !== null;
  const elapsed = elapsedTimedSet(clockState, now);
  const left = target == null ? 0 : Math.max(0, target - elapsed);

  const reportRunning = (value: boolean) => {
    if (runningRef.current === value) return;
    runningRef.current = value;
    callbacks.current.onRunningChange?.(value);
  };
  const updateClock = (next: TimedSetClock) => {
    stateRef.current = next;
    setClockState(next);
    callbacks.current.onClockChange?.(next);
  };
  // Persist the current clock only on controls and interruption, not 5x/s.
  useEffect(() => {
    callbacks.current.onClockChange?.(stateRef.current);
    return () => {
      const snapshot = pauseTimedSet(stateRef.current, Date.now());
      callbacks.current.onClockChange?.(snapshot);
      if (runningRef.current) callbacks.current.onRunningChange?.(false);
    };
  }, []);
  // A saved or edited exercise duration can change after onDone updates the
  // set. Invalidate partial progress from the previous target rather than
  // incorrectly resuming a countdown configured for a different duration.
  useEffect(() => {
    if (stateRef.current.target === target) return;
    reportRunning(false);
    finished.current = false;
    fired.current = new Set();
    updateClock(resetTimedSet(target));
  }, [target]);
  useEffect(() => {
    if (clockState.since === null) return;
    const tick = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(tick);
  }, [clockState.since]);
  useEffect(() => {
    if ((screenFocused && !blocked) || stateRef.current.since === null) return;
    const paused = pauseTimedSet(stateRef.current, Date.now());
    updateClock(paused);
    reportRunning(false);
  }, [screenFocused, blocked]);
  // A recovered stopwatch or countdown is paused, never silently marked done.
  useEffect(() => {
    if (!screenFocused || !running || !target || finished.current) return;
    const pr = getPrefs(), f = fired.current, s = Math.ceil(left);
    if (pr.halfway && target >= 20 && left <= target / 2 && !f.has('half')) {
      f.add('half'); void say('Halfway');
    }
    if (pr.countdown) for (const n of [3, 2, 1]) {
      if (s === n && target > n && !f.has(String(n))) {
        f.add(String(n)); buzz(); void say(String(n));
      }
    }
    if (left <= 0) {
      finished.current = true;
      void bell();
      updateClock(resetTimedSet(target));
      reportRunning(false);
      callbacks.current.onDone(target);
    }
  }, [screenFocused, running, target, left]);

  const start = () => {
    if (blocked || !screenFocused || running) return;
    fired.current = new Set();
    finished.current = false;
    const tick = Date.now();
    setNow(tick);
    updateClock(resumeTimedSet(stateRef.current, tick));
    reportRunning(true);
    void bell().then(() => say('Go'));
  };
  useEffect(() => {
    if (autoGo && !running && !blocked && screenFocused && stateRef.current.elapsedBefore === 0) start();
  }, [autoGo]); // An explicit parent auto-start is a single event.
  const stop = () => {
    const snapshot = pauseTimedSet(stateRef.current, Date.now());
    updateClock(snapshot);
    reportRunning(false);
    const seconds = Math.round(snapshot.elapsedBefore);
    if (seconds > 0) {
      finished.current = true;
      void bell();
      callbacks.current.onDone(seconds);
      updateClock(resetTimedSet(target));
    }
  };
  const reset = () => {
    reportRunning(false);
    finished.current = false;
    fired.current = new Set();
    updateClock(resetTimedSet(target));
  };
  const hasPartial = !running && clockState.elapsedBefore > 0;
  const recoveredAtLimit = hasPartial && target !== null && clockState.elapsedBefore >= target;
  const frac = target ? Math.max(0, 1 - left / target) : 0;
  return (
    <View style={{ flex: 1, minWidth: compact ? 64 : 96, flexDirection: 'row', gap: 3 }}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={running ? `Stop ${label} timer` : recoveredAtLimit ? `Restart ${label} timer` : hasPartial ? `Resume ${label} timer` : `Start ${label} timer`}
        disabled={!running && (blocked || !screenFocused)}
        onPress={running ? stop : start}
        style={{ flex: 1, minWidth: 56, height: 44, borderRadius: R.sm, overflow: 'hidden',
          borderWidth: 1.5, borderColor: running ? p.focus : p.line,
          backgroundColor: p.surface, justifyContent: 'center',
          opacity: !running && (blocked || !screenFocused) ? 0.45 : 1 }}>
        {running && target ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${frac * 100}%`, backgroundColor: p.glow }} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Icon name={running ? 'stop' : 'play_arrow'} size={18} color={p.focus} />
          <Txt style={{ fontFamily: F.bodyBold, fontSize: 16, fontVariant: ['tabular-nums'], color: p.ink }}>
            {running || hasPartial ? clock(target ? Math.ceil(left) : elapsed) : target ? clock(target) : 'Start'}
          </Txt>
        </View>
      </Pressable>
      {hasPartial && <Pressable accessibilityRole="button" accessibilityLabel={`Reset partial ${label} timer`}
        onPress={reset} style={{ width: 32, height: 44, justifyContent: 'center', alignItems: 'center',
          backgroundColor: p.soft, borderRadius: R.sm }}>
        <Icon name="replay" color={p.ink} size={18} />
      </Pressable>}
    </View>
  );
}
