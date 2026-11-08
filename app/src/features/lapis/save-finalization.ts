/** Timer events must not mutate or revive a workout while it is being
 * persisted, after discard/save, or after its route changes.
 */
export function canMutateWorkoutTimer(
  expectedRoute: string,
  currentRoute: string,
  saving: boolean,
  finalized: boolean,
): boolean {
  return expectedRoute === currentRoute && !saving && !finalized;
}
