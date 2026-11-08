import type { RunnerClock } from './runner-clock';
import { elapsedAt } from './runner-clock';

/** Only background/inactive running timers should schedule a native reminder.
 * An unknown initial AppState is treated as foreground until a real event.
 */
export function reminderSeconds(
  appState: string | null | undefined,
  clock: RunnerClock,
  totalSeconds: number,
  blocked: boolean,
  now: number,
): number | null {
  if (appState !== 'background' && appState !== 'inactive') return null;
  if (blocked || clock.since === null || clock.skipped) return null;
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  const left = totalSeconds - elapsedAt(clock, now, totalSeconds);
  return left > 0 ? left : null;
}
