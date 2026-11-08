/** React timer identities must include their owning workout. */
export function timerInstanceKey(sessionId: string, timerId: string): string {
  if (!sessionId || !timerId) throw new Error('Timer identity requires workout and block');
  return JSON.stringify([sessionId, timerId]);
}
