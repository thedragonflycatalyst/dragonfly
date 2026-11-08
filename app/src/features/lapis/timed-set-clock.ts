/** Individual timed-set state stored in Coach's local workout draft.
 * A set is not a completed exercise until the user stops it or reaches its
 * target. Paused progress is intentionally distinct from logged set data.
 */
export type TimedSetClock = {
  elapsedBefore: number;
  since: number | null;
  target: number | null;
};
export const emptyTimedSetClock = (target: number | null): TimedSetClock => ({
  elapsedBefore: 0, since: null, target,
});
const duration = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 86400;
const validTarget = (target: number | null) => target == null ||
  (Number.isFinite(target) && target > 0 && target <= 86400);
export function elapsedTimedSet(clock: TimedSetClock, now: number): number {
  const elapsed = clock.elapsedBefore +
    (clock.since === null ? 0 : Math.max(0, now - clock.since) / 1000);
  return Math.min(clock.target ?? 86400, Math.max(0, elapsed));
}
export function restoreTimedSetClock(raw: unknown, target: number | null, now: number): TimedSetClock {
  if (!validTarget(target) || !raw || typeof raw !== 'object') return emptyTimedSetClock(target);
  const c = raw as Partial<TimedSetClock>;
  if (!duration(c.elapsedBefore) || !(c.since === null ||
      typeof c.since === 'number' && Number.isFinite(c.since) &&
      c.since > 0 && c.since <= now) || c.target !== target) return emptyTimedSetClock(target);
  // Do not silently finish or log a set after a process restart. Catch up
  // elapsed time, but restore in the paused state for explicit confirmation.
  const current = { elapsedBefore: c.elapsedBefore as number, since: c.since as number | null, target };
  return { elapsedBefore: elapsedTimedSet(current, now), since: null, target };
}
export function pauseTimedSet(clock: TimedSetClock, now: number): TimedSetClock {
  return clock.since === null ? clock : {
    ...clock, elapsedBefore: elapsedTimedSet(clock, now), since: null,
  };
}
export function resumeTimedSet(clock: TimedSetClock, now: number): TimedSetClock {
  if (clock.since !== null) return clock;
  if (clock.target !== null && clock.elapsedBefore >= clock.target)
    return { ...clock, elapsedBefore: 0, since: now };
  return { ...clock, since: now };
}
export function resetTimedSet(target: number | null): TimedSetClock {
  return emptyTimedSetClock(target);
}
