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
