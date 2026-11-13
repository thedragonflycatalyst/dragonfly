// Lapis inside a workout: the rest timer that starts when a set is ticked, and the mini timer for timed sets
// (sprints, carries, planks). Cues follow the person's Lapis settings: voice, music mode, bell, vibration.
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { Icon, Txt } from '@/components/ui';
import { clock } from '@/lib/session';
import { F, R, usePalette } from '@/lib/theme';
import { bell, bellThenSay, buzz, hush, say } from './audio';
import { getPrefs } from './prefs';
import { clearRestNotification, showRestCountdown, showRestFinished } from '../../../modules/rest-notification';
import { recall, store } from '@/lib/supabase';
import { canScheduleWorkoutNotification } from './workout-session-lease';
import { addRestSeconds, createRestClock, pauseRestClock, restRemaining, restoreRestClock, resumeRestClock, type RestClock } from './rest-clock';
import { elapsedTimedSet, pauseTimedSet, resetTimedSet, restoreTimedSetClock, resumeTimedSet, type TimedSetClock } from './timed-set-clock';

/* ---------- background rest notifications, scoped to current workout ---------- */
let backstopQueue: Promise<void> = Promise.resolve();
const REST_CHANNEL = 'rest-bell';
async function backstop(sessionId: string, at: number | null, body = 'Rest is over. Next set!') {
  const task = async () => {
    if (Platform.OS === 'web') return;
    try {
      const N = await import('expo-notifications');
      // A prior app process may have scheduled a rest notification. We only
      // cancel our own rest reminders, not unrelated notification categories.
      for (const item of await N.getAllScheduledNotificationsAsync()) {
        if (item.content.data?.kind === 'rest' &&
            item.content.data?.lapisSessionId === sessionId) {
          await N.cancelScheduledNotificationAsync(item.identifier).catch(() => {});
        }
      }
      if (at === null || !canScheduleWorkoutNotification(sessionId)) return;
      if (at - Date.now() < 1500) return;
      if (Platform.OS === 'android') {
        // A new channel id: Android keeps a channel's sound forever, and phones that made "rest" before it had the
        // bell would stay silent. This one always rings the bell and vibrates, and shows on the lock screen.
        await N.setNotificationChannelAsync(REST_CHANNEL, {
          name: 'Rest timer: back to work', importance: N.AndroidImportance.MAX,
          sound: 'bell_ring2.wav', vibrationPattern: [0, 250, 120, 250], enableVibrate: true,
          lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
        });
      }
      if (!canScheduleWorkoutNotification(sessionId)) return;
      const id = await N.scheduleNotificationAsync({
        content: { title: 'Back to work', body, sound: 'bell_ring2.wav', interruptionLevel: 'timeSensitive',
          data: { kind: 'rest', lapisSessionId: sessionId } },
        // alarmClock: Android delivers it on the second, never deferred for battery saving (needs "Alarms & reminders")
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at + 1000, delivery: 'alarmClock',
          ...(Platform.OS === 'android' ? { channelId: REST_CHANNEL } : {}) },
      });
      if (!canScheduleWorkoutNotification(sessionId))
        await N.cancelScheduledNotificationAsync(id).catch(() => {});
    } catch { /* foreground rest clock remains authoritative */ }
  };
  const next = backstopQueue.catch(() => {}).then(task);
  backstopQueue = next;
  await next;
}
/** The first rest asks (once) for notifications, so the bell can ring with the app in the background.
 * On Android 14+ it also opens "Alarms & reminders" once, so the bell rings on time instead of minutes late. */
let asked = false;
async function ensureRestAlerts() {
  if (Platform.OS === 'web' || asked) return;
  asked = true;
  try {
    const N = await import('expo-notifications');
    const perm = await N.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) await N.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } });
    if (Platform.OS === 'android' && !recall<boolean>('lapis.exactAlarmAsked', false)) {
      const exact = await N.getExactAlarmPermissionsAsync();
      if (!exact.granted && exact.canAskAgain) { store('lapis.exactAlarmAsked', true); await N.requestExactAlarmPermissionsAsync(); }
    }
  } catch { /* the in-app timer still works */ }
}
export async function clearOtherWorkoutRestReminders(sessionId: string) {
  const task = async () => {
    if (Platform.OS === 'web' || !canScheduleWorkoutNotification(sessionId)) return;
    try {
      const N = await import('expo-notifications');
      for (const item of await N.getAllScheduledNotificationsAsync()) {
        if (!canScheduleWorkoutNotification(sessionId)) return;
        if (item.content.data?.kind === 'rest' &&
          item.content.data?.lapisSessionId !== sessionId) {
          await N.cancelScheduledNotificationAsync(item.identifier).catch(() => {});
        }
      }
    } catch { /* native notifications may be unavailable */ }
  };
  const next = backstopQueue.catch(() => {}).then(task);
  backstopQueue = next;
  await next;
}

export type Rest = RestClock;

/** Safe rest recovery: live clocks catch up by absolute time; restored clocks
 * always start paused and never replay missed cues or auto-start a timed set.
 */
export function useRest(sessionId: string, onNextSet?: (key: string) => void, onChange?: (rest: RestClock | null) => void) {
  const [rest, setRest] = useState<RestClock | null>(null);
  const [stateSessionId, setStateSessionId] = useState(sessionId);
  useEffect(() => {
    // A mounted Session route may change workouts without remounting its hook.
    // Never let the previous workout's rest complete under the new session id.
    restRef.current = null;
    fired.current = new Set();
    setRest(null);
    setStateSessionId(sessionId);
  }, [sessionId]);
  const [, setNow] = useState(Date.now());
  const fired = useRef(new Set<string>());
  const restRef = useRef(rest);
  restRef.current = rest;
  const nextRef = useRef(onNextSet);
  nextRef.current = onNextSet;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const update = (next: RestClock | null) => {
    restRef.current = next;
    setRest(next);
    changeRef.current?.(next);
  };
  const active = stateSessionId === sessionId && !!rest && rest.pausedLeft === null;
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(interval);
  }, [active]);

  // React timers do not run reliably while backgrounded. Only the native
  // rest reminder may fire; returning to foreground clears the reminder.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!canScheduleWorkoutNotification(sessionId)) return;
      const latest = restRef.current;
      if (state === 'active') {
        // The in-app timer takes over again; the scheduled alert is only for while the app is away
        void backstop(sessionId, null);
        if (latest && latest.pausedLeft === null && latest.until <= Date.now()) {
          showRestFinished('Back to work', latest.label ? `Rest is over. ${latest.label}` : 'Rest is over. Next set!');
          // OS may have suspended JS through the deadline. Dismiss an
          // overdue rest without replaying its bell or advancing a set.
          fired.current.add('end');
          update(null);
        }
      } else if (latest && latest.pausedLeft === null)
        void backstop(sessionId, latest.until, latest.label ? `Rest is over. ${latest.label}` : undefined);
    });
    return () => { sub.remove(); void backstop(sessionId, null); };
  }, [sessionId]);

  const left = stateSessionId === sessionId && rest ? restRemaining(rest, Date.now()) : 0;
  useEffect(() => {
    if (stateSessionId !== sessionId || !rest || rest.pausedLeft !== null || !canScheduleWorkoutNotification(sessionId) ||
        AppState.currentState !== 'active') return;
    const prefs = getPrefs(), f = fired.current, sec = Math.ceil(left);
    if (prefs.halfway && rest.total >= 20 && left <= rest.total / 2 && !f.has('half')) {
      f.add('half'); void say('Halfway');
    }
    if (prefs.countdown) for (const n of [3, 2, 1]) {
      if (sec === n && rest.total > n && !f.has(String(n))) {
        f.add(String(n)); buzz(); void say(String(n));
      }
    }
    if (left <= 0 && !f.has('end')) {
      f.add('end');
      void backstop(sessionId, null);
      void bell();
      showRestFinished('Back to work', rest.label ? `Rest is over. ${rest.label}` : 'Rest is over. Next set!');
      const nextKey = rest.nextSetKey;
      update(null);
      if (nextKey) nextRef.current?.(nextKey);
    }
  }, [rest, left]);

  const restore = (snapshot: unknown) => {
    fired.current = new Set();
    void backstop(sessionId, null);
    update(restoreRestClock(snapshot, Date.now()));
  };
  const start = (seconds: number, label = '', nextSetKey: string | null = null) => {
    if (!canScheduleWorkoutNotification(sessionId)) return;
    if (seconds <= 0) {
      if (nextSetKey) nextRef.current?.(nextSetKey);
      return;
    }
    const next = createRestClock(seconds, label, nextSetKey, Date.now());
    fired.current = new Set();
    update(next);
    buzz();
    if (getPrefs().sayRest) void say('Rest');
    void ensureRestAlerts();
    void backstop(sessionId, next.until, next.label ? `Rest is over. ${next.label}` : undefined);
    showRestCountdown(next.until, 'Rest', next.label ? `Next: ${next.label}` : 'Back to work when it hits zero');
  };
  const add = (seconds: number) => {
    if (!canScheduleWorkoutNotification(sessionId)) return;
    const next = addRestSeconds(restRef.current, seconds, Date.now());
    for (const key of ['3', '2', '1', 'half']) fired.current.delete(key);
    update(next);
    if (next?.pausedLeft === null) {
      void backstop(sessionId, next.until, next.label ? `Rest is over. ${next.label}` : undefined);
      showRestCountdown(next.until, 'Rest', next.label ? `Next: ${next.label}` : 'Back to work when it hits zero');
    }
  };
  const pause = () => {
    void backstop(sessionId, null);
    clearRestNotification();
    const next = pauseRestClock(restRef.current, Date.now());
    if (next !== restRef.current) update(next);
  };
  const resume = () => {
    if (!canScheduleWorkoutNotification(sessionId)) return;
    const next = resumeRestClock(restRef.current, Date.now());
    if (next === restRef.current) return;
    update(next);
    if (next) {
      void backstop(sessionId, next.until, next.label ? `Rest is over. ${next.label}` : undefined);
      showRestCountdown(next.until, 'Rest', next.label ? `Next: ${next.label}` : 'Back to work when it hits zero');
    }
  };
  const skip = () => { void backstop(sessionId, null); clearRestNotification(); update(null); };
  return { rest: stateSessionId === sessionId ? rest : null, left, start, add, pause, resume, skip, restore };
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
        <Pressable accessibilityRole="button" accessibilityLabel="15 seconds less" disabled={blocked} onPress={() => t.add(-15)} style={[btn, blocked && { opacity: 0.45 }]}><Txt v="smallBold" color={p.ink}>−15</Txt></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="15 seconds more" disabled={blocked} onPress={() => t.add(15)} style={[btn, blocked && { opacity: 0.45 }]}><Txt v="smallBold" color={p.ink}>+15</Txt></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={resumeBlocked ? 'Pause Lapis to resume rest' : paused ? 'Resume rest' : 'Pause rest'} disabled={resumeBlocked} onPress={paused ? t.resume : t.pause} style={[btn, resumeBlocked && { opacity: 0.4 }]}><Icon name={paused ? 'play_arrow' : 'pause'} color={p.ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip rest" disabled={blocked} onPress={t.skip} style={[btn, { backgroundColor: p.fill }, blocked && { opacity: 0.45 }]}><Icon name="skip_next" color={p.onAccent} /></Pressable>
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
  screenFocused = true, canCue, onRunningChange, initialClock, onClockChange,
}: {
  target: number | null;
  onDone: (seconds: number) => void;
  label: string;
  compact?: boolean;
  go?: number;
  blocked?: boolean;
  screenFocused?: boolean;
  canCue?: () => boolean;
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
  // A timed set is never marked complete just because the OS suspended JS
  // through its deadline. Return paused; the user chooses when to resume.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' || stateRef.current.since === null) return;
      const snapshot = pauseTimedSet(stateRef.current, Date.now());
      updateClock(snapshot);
      reportRunning(false);
    });
    return () => subscription.remove();
  }, []);

  // A recovered stopwatch or countdown is paused, never silently marked done.
  useEffect(() => {
    if (!screenFocused || !(canCue?.() ?? true) || AppState.currentState !== 'active' ||
        !running || !target || finished.current) return;
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
    if (blocked || !screenFocused || !(canCue?.() ?? true) || running) return;
    fired.current = new Set();
    finished.current = false;
    const tick = Date.now();
    setNow(tick);
    updateClock(resumeTimedSet(stateRef.current, tick));
    reportRunning(true);
    void bellThenSay('Go');
  };
  useEffect(() => {
    if (autoGo && !running && !blocked && screenFocused && stateRef.current.elapsedBefore === 0) start();
  }, [autoGo]); // An explicit parent auto-start is a single event.
  const stop = () => {
    if (!screenFocused || !(canCue?.() ?? true) || stateRef.current.since === null) return;
    // Cancel a delayed "Go" after the start bell, before the stop bell.
    hush();
    const snapshot = pauseTimedSet(stateRef.current, Date.now());
    updateClock(snapshot);
    reportRunning(false);
    const seconds = Math.round(snapshot.elapsedBefore);
    if (seconds > 0 && !finished.current) {
      finished.current = true;
      void bell();
      callbacks.current.onDone(seconds);
      updateClock(resetTimedSet(target));
    }
  };
  const reset = () => {
    if (!screenFocused || blocked || !(canCue?.() ?? true)) return;
    hush(); // Prevent a prior Go/bell from outliving manual reset.
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

/** Clears the tagged rest reminder for a completed or discarded workout.
 * The serialized queue makes an earlier in-flight schedule finish first.
 */
export async function clearWorkoutRestReminder(sessionId: string): Promise<void> {
  clearRestNotification();
  await backstop(sessionId, null);
}
