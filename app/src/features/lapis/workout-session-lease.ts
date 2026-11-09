/** One visible Coach workout owns global Lapis audio and native reminders.
 * The lease token distinguishes concurrent mounts of even the same workout.
 */
let lease: { token: string; sessionId: string } | null = null;
export function claimWorkoutSession(token: string, sessionId: string): void {
  lease = { token, sessionId };
}
export function isWorkoutSessionOwner(token: string): boolean {
  return lease?.token === token;
}
export function currentWorkoutSessionId(): string | null {
  return lease?.sessionId ?? null;
}
export function releaseWorkoutSession(token: string): boolean {
  if (!isWorkoutSessionOwner(token)) return false;
  lease = null;
  return true;
}
export function canScheduleWorkoutNotification(sessionId: string): boolean {
  return !!sessionId && lease?.sessionId === sessionId;
}
