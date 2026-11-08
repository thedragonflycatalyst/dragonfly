/** One Coach workout owns one audible countdown at a time.
 * A manually paused rest is allowed to coexist with an active linked timer.
 */
export type TimerOwnership = {
  linked: string | null;
  timedSet: string | null;
};
export function canStartLinkedTimer(owner: TimerOwnership, id: string): boolean {
  return owner.timedSet === null && (owner.linked === null || owner.linked === id);
}
export function canStartTimedSet(owner: TimerOwnership, id: string): boolean {
  return owner.linked === null && (owner.timedSet === null || owner.timedSet === id);
}
export function canResumeRest(owner: TimerOwnership): boolean {
  return owner.linked === null && owner.timedSet === null;
}
