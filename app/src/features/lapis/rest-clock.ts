/** Serializable Coach rest countdown plus the optional next timed-set target.
 * A callback is never stored in the draft: only the stable set key is.
 */
export type RestClock = {
  until: number;
  total: number;
  label: string;
  pausedLeft: number | null;
  nextSetKey: string | null;
};
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const bounded = (value: unknown): value is number =>
  finite(value) && value >= 0 && value <= 86400;
export function restRemaining(rest: RestClock, now: number): number {
  return rest.pausedLeft ?? Math.max(0, (rest.until - now) / 1000);
}
export function createRestClock(
  seconds: number, label: string, nextSetKey: string | null, now: number,
): RestClock {
  const total = bounded(seconds) ? seconds : 0;
  return { until: now + total * 1000, total, label: label.slice(0, 200),
    pausedLeft: null, nextSetKey };
}
export function pauseRestClock(rest: RestClock | null, now: number): RestClock | null {
  if (!rest || rest.pausedLeft !== null) return rest;
  return { ...rest, pausedLeft: restRemaining(rest, now) };
}
export function resumeRestClock(rest: RestClock | null, now: number): RestClock | null {
  if (!rest || rest.pausedLeft === null || rest.pausedLeft <= 0) return rest;
  return { ...rest, until: now + rest.pausedLeft * 1000, pausedLeft: null };
}
export function restoreRestClock(raw: unknown, now: number): RestClock | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Partial<RestClock>;
  if (!bounded(value.total) || value.total <= 0 ||
    !finite(value.until) || value.until <= 0 ||
    !(value.pausedLeft === null || bounded(value.pausedLeft)) ||
    typeof value.label !== 'string' || value.label.length > 200 ||
    !(value.nextSetKey === null ||
      typeof value.nextSetKey === 'string' && value.nextSetKey.length > 0 &&
      value.nextSetKey.length <= 120)) return null;
  const rest = value as RestClock;
  const left = Math.min(rest.total, restRemaining(rest, now));
  // Do not fire a stale bell or an automatic next-set transition on app
  // restart. If the deadline passed while away, dismiss that rest completely.
  if (left <= 0) return null;
  return { ...rest, pausedLeft: left, until: now + left * 1000 };
}
export function addRestSeconds(rest: RestClock | null, delta: number, now: number): RestClock | null {
  if (!rest || !finite(delta)) return rest;
  const total = Math.max(1, Math.min(86400, rest.total + delta));
  const left = Math.max(1, Math.min(86400, restRemaining(rest, now) + delta));
  return rest.pausedLeft !== null
    ? { ...rest, total, pausedLeft: left }
    : { ...rest, total, until: now + left * 1000 };
}
