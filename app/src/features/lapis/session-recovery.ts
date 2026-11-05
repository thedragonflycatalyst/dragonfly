import { pauseClock, validClock, type RunnerClock } from './runner-clock';
import { restoreTimedSetClock, type TimedSetClock } from './timed-set-clock';

/** Restored linked intervals must not keep running in another workout,
 * report an unobserved finish, or retain a stale audio lease after a crash.
 * A completed interval with a saved result remains complete; otherwise an
 * expired interval returns to one second before the end for explicit resume.
 */
export function recoverLinkedClocks(
  saved: Record<string, RunnerClock> | undefined,
  totals: Record<string, number>,
  completedBlockIds: readonly string[],
  now: number,
): Record<string, RunnerClock> {
  const recovered: Record<string, RunnerClock> = {};
  const completed = new Set(completedBlockIds);
  for (const [block, value] of Object.entries(saved ?? {})) {
    const total = totals[block];
    if (!Number.isFinite(total) || total <= 0) continue;
    const normalized = validClock(value, total);
    const paused = normalized.since === null ? normalized : pauseClock(normalized, now, total);
    if (paused.hasStarted && paused.elapsedBefore >= total && !completed.has(block)) {
      recovered[block] = { ...paused, since: null, elapsedBefore: Math.max(0, total - 1) };
    } else {
      recovered[block] = { ...paused, since: null };
    }
  }
  return recovered;
}

/** A running timed exercise also comes back paused, even if it reached the
 * planned duration while the application was suspended.
 */
export function recoverTimedSetClocks(
  saved: Record<string, TimedSetClock> | undefined,
  now: number,
): Record<string, TimedSetClock> {
  const result: Record<string, TimedSetClock> = {};
  for (const [key, value] of Object.entries(saved ?? {})) {
    if (!value || !(value.target === null ||
        typeof value.target === 'number' && Number.isFinite(value.target))) continue;
    result[key] = restoreTimedSetClock(value, value.target, now);
  }
  return result;
}
