/** Serializable timeline clock state; UTC epoch milliseconds, not accumulated ticks.
 * A paused timer is frozen. A running timer catches up after suspension/restart.
 */
export type RunnerClock = {
  elapsedBefore: number;
  since: number | null;
  hasStarted: boolean;
  skipped: boolean;
};
export const freshClock = (): RunnerClock => ({
  elapsedBefore: 0, since: null, hasStarted: false, skipped: false,
});
export function validClock(value: unknown, total: number): RunnerClock {
  if (!value || typeof value !== 'object') return freshClock();
  const raw = value as Partial<RunnerClock>;
  if (typeof raw.elapsedBefore !== 'number' || !Number.isFinite(raw.elapsedBefore) ||
      raw.elapsedBefore < 0 || raw.elapsedBefore > total ||
      !(raw.since === null || typeof raw.since === 'number' && Number.isFinite(raw.since) && raw.since > 0) ||
      typeof raw.hasStarted !== 'boolean' || typeof raw.skipped !== 'boolean') return freshClock();
  return {
    elapsedBefore: raw.elapsedBefore,
    since: raw.hasStarted ? raw.since : null,
    hasStarted: raw.hasStarted,
    skipped: raw.skipped,
  };
}
export function elapsedAt(clock: RunnerClock, now: number, total: number) {
  return Math.min(total, clock.elapsedBefore +
    (clock.since == null ? 0 : Math.max(0, now - clock.since) / 1000));
}
export function startClock(clock: RunnerClock, now: number, total: number): RunnerClock {
  if (elapsedAt(clock, now, total) >= total) return { elapsedBefore: 0, since: now, hasStarted: true, skipped: false };
  return { ...clock, since: now, hasStarted: true };
}
export function pauseClock(clock: RunnerClock, now: number, total: number): RunnerClock {
  return { ...clock, elapsedBefore: elapsedAt(clock, now, total), since: null };
}
export function skipClock(clock: RunnerClock, now: number, endAt: number): RunnerClock {
  return { ...clock, elapsedBefore: endAt, since: clock.since == null ? null : now, skipped: true };
}
