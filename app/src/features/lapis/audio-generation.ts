/** An async cue remains valid only for the generation in which it began.
 * Every explicit hush or workout ownership transition advances the epoch.
 */
export function sameAudioGeneration(start: number, current: number): boolean {
  return start === current;
}
