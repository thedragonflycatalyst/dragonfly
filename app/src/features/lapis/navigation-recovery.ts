import type { RestClock } from './rest-clock';
import type { TimedSetClock } from './timed-set-clock';
import { pauseClock, type RunnerClock } from './runner-clock';

/** Navigation away pauses, unlike temporary OS backgrounding.
 * Already-paused clocks are not changed.
 */
export function pauseForNavigation(clock: RunnerClock, now: number, total: number): RunnerClock {
  return clock.since === null ? clock : pauseClock(clock, now, total);
}

/** Synchronous last clock snapshot update during navigation blur. */
export function patchDraftClock(draft: unknown, key: string, blockId: string, clock: RunnerClock): string | null {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const d = draft as Record<string, unknown>;
  if (d.key !== key || !Array.isArray(d.log)) return null;
  const old = d.runnerClocks && typeof d.runnerClocks === 'object' &&
    !Array.isArray(d.runnerClocks) ? d.runnerClocks as Record<string, unknown> : {};
  return JSON.stringify({ ...d, runnerClocks: { ...old, [blockId]: clock } });
}

/** Save one partial timed set during route transition or imminent unmount. */
export function patchDraftTimedSetClock(draft: unknown, key: string, setKey: string, clock: TimedSetClock): string | null {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const d = draft as Record<string, unknown>;
  if (d.key !== key || !Array.isArray(d.log)) return null;
  const previous = d.timedSetClocks && typeof d.timedSetClocks === 'object' &&
    !Array.isArray(d.timedSetClocks) ? d.timedSetClocks as Record<string, unknown> : {};
  return JSON.stringify({ ...d, timedSetClocks: { ...previous, [setKey]: clock } });
}

/** Checkpoint rest without overwriting an unrelated workout draft. */
export function patchDraftRestClock(draft: unknown, key: string, rest: RestClock | null): string | null {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const d = draft as Record<string, unknown>;
  if (d.key !== key || !Array.isArray(d.log)) return null;
  return JSON.stringify({ ...d, restClock: rest });
}
