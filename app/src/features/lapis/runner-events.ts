import type { LapisTimeline } from './timeline';

/** Only announce a phase transition if it was observed close to its boundary.
 * Avoid an arbitrary "Work!" announcement on app restoration after minutes
 * in the background, and avoid duplicate announcements on pause/resume.
 */
export function phaseTransitionDue(
  timeline: LapisTimeline,
  previousIndex: number | null,
  nextIndex: number,
  elapsed: number,
  foreground: boolean,
  startedHere: boolean,
): boolean {
  if (!foreground || nextIndex < 0 || nextIndex >= timeline.phases.length) return false;
  if (previousIndex === nextIndex) return false;
  const phase = timeline.phases[nextIndex];
  if (elapsed < phase.startAt || elapsed - phase.startAt > 1.5) return false;
  // Null is only acceptable for an explicit fresh start, not restored state.
  return previousIndex !== null || startedHere;
}

/** A completed run is eligible for logging only if all intervals were played
 * without skipping, and the timer actually reached the end.
 */
export function completedNaturally(
  hasStarted: boolean, skipped: boolean, elapsed: number, total: number,
): boolean {
  return hasStarted && !skipped && total > 0 && elapsed >= total;
}
