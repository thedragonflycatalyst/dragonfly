/** The server assignment UUID is generated before the network request and
 * stored in the local draft. A repeated insert of that exact UUID is safe to
 * resolve after transport failures; the primary key is the idempotency key.
 */
export type AssignmentIdentity = {
  id: string;
  client_id: string;
  trainer_id: string;
  workout_id: string | null;
};
export function matchesPendingAssignment(
  value: unknown,
  id: string,
  trainerId: string,
  clientId: string,
  workoutId: string | null,
): value is AssignmentIdentity {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return row.id === id && row.trainer_id === trainerId &&
    row.client_id === clientId && row.workout_id === workoutId;
}

/** The clock restored from disk may contain multiple running timers after a
 * crash or older version. Keep only the most recently activated timer live.
 */
export function activeLinkedTimer(
  clocks: Record<string, { since: number | null }>,
  validBlockIds: string[],
): string | null {
  let id: string | null = null;
  let newest = -1;
  for (const blockId of validBlockIds) {
    const since = clocks[blockId]?.since;
    if (typeof since === 'number' && Number.isFinite(since) && since > newest) {
      newest = since;
      id = blockId;
    }
  }
  return id;
}
