import type { LapisTimerResult } from '@/lib/model';
import type { RunnerClock } from './runner-clock';
import type { TimedSetClock } from './timed-set-clock';

/** Save must not race a timer's final callback or a manual stop. */
export function activeWorkoutTimers(
  runnerClocks: Record<string, RunnerClock>,
  setClocks: Record<string, TimedSetClock>,
  linkedOwner: string | null,
  timedSetOwner: string | null,
): boolean {
  return linkedOwner !== null || timedSetOwner !== null ||
    Object.values(runnerClocks).some((clock) => clock.since !== null) ||
    Object.values(setClocks).some((clock) => clock.since !== null);
}

/** Results are keyed by the workout block; duplicate completion events for the
 * same finished run are harmless and an older callback cannot overwrite a
 * newer completion. A restarted timer must clear its old result first.
 */
export function recordTimerCompletion(
  current: LapisTimerResult[], result: LapisTimerResult,
): LapisTimerResult[] {
  if (!result.block_id || !result.timer_id ||
    !Number.isFinite(result.actual_seconds) || result.actual_seconds < 0 ||
    !Number.isFinite(result.planned_seconds) || result.planned_seconds <= 0 ||
    !Number.isFinite(Date.parse(result.completed_at))) return current;
  const existing = current.find((x) => x.block_id === result.block_id);
  if (existing && Date.parse(existing.completed_at) >= Date.parse(result.completed_at)) return current;
  return [...current.filter((x) => x.block_id !== result.block_id), result];
}
export function clearTimerCompletion(current: LapisTimerResult[], blockId: string) {
  return current.filter((x) => x.block_id !== blockId);
}

/** Ignore duplicated set-completion callbacks after the exact set was logged. */
export function shouldAcceptTimedSetCompletion(
  alreadyDone: boolean, seconds: number,
): boolean {
  return !alreadyDone && Number.isFinite(seconds) && seconds > 0 && seconds <= 86400;
}
