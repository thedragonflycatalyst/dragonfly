import type { Draft } from './session';

export type DraftStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
export function parseDraft(raw: string | null): Draft | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const draft = value as Partial<Draft>;
    return typeof draft.key === 'string' && Array.isArray(draft.log) &&
      typeof draft.title === 'string' && typeof draft.started === 'number' &&
      Number.isFinite(draft.started) ? draft as Draft : null;
  } catch { return null; }
}
/** Only the currently owning session may write a draft. Never overwrite
 * timer checkpoints that landed after an earlier React render.
 */
export function writeDraftCore(store: DraftStore, slot: string, draft: Draft): boolean {
  const previous = parseDraft(store.getItem(slot));
  if (previous && previous.key !== draft.key) return false;
  store.setItem(slot, JSON.stringify({
    ...(previous ?? draft),
    key: draft.key, title: draft.title, params: draft.params,
    client_id: draft.client_id, started: draft.started,
    log: draft.log, timerResults: draft.timerResults,
    pendingAssignmentId: previous?.pendingAssignmentId ?? draft.pendingAssignmentId,
  } satisfies Draft));
  return true;
}
export function writeDraftPatch(store: DraftStore, slot: string, key: string,
  patch: Partial<Omit<Draft, 'key'>>): boolean {
  const previous = parseDraft(store.getItem(slot));
  if (!previous || previous.key !== key) return false;
  store.setItem(slot, JSON.stringify({ ...previous, ...patch, key }));
  return true;
}
export function clearMatchingDraft(store: DraftStore, slot: string, key: string): boolean {
  if (parseDraft(store.getItem(slot))?.key !== key) return false;
  store.removeItem(slot);
  return true;
}

/** Called only once a newly selected session has fully hydrated. This is the
 * explicit ownership transition for the app's single draft slot. Late
 * callbacks from the previous workout still fail key-matched patches.
 */
export function beginWorkoutDraft(store: DraftStore, slot: string, draft: Draft): void {
  const current = parseDraft(store.getItem(slot));
  if (!current || current.key !== draft.key)
    store.setItem(slot, JSON.stringify(draft));
}

/** Every workout has its own independent localStorage document. The URI-like
 * session key is encoded to prevent collisions with separators or punctuation.
 */
export function workoutDraftSlot(key: string): string {
  if (!key || !/^(a|w):.+$/.test(key)) throw new Error('Invalid workout draft key');
  return 'dragonfly.session.v2:' + encodeURIComponent(key);
}
/** Copy the legacy single-slot draft once, without replacing a newer v2
 * snapshot. Delete the legacy slot only after the new write is confirmed.
 */
export function loadWorkoutDraft(store: DraftStore, key: string, legacySlot = 'dragonfly.session'): Draft | null {
  const slot = workoutDraftSlot(key);
  const current = parseDraft(store.getItem(slot));
  if (current?.key === key) return current;
  // A corrupted/mismatched v2 record must not be overwritten implicitly.
  if (store.getItem(slot) !== null) return null;
  const legacy = parseDraft(store.getItem(legacySlot));
  if (!legacy || legacy.key !== key) return null;
  store.setItem(slot, JSON.stringify(legacy));
  const written = parseDraft(store.getItem(slot));
  if (!written || written.key !== key) return null;
  store.removeItem(legacySlot);
  return written;
}
/** Returns saved draft identifiers without parsing other localStorage content.
 * Intended for a future "Resume workouts" list or recovery menu.
 */
export function listWorkoutDrafts(store: DraftStore & { length: number; key(index: number): string | null }): Draft[] {
  const prefix = 'dragonfly.session.v2:';
  const drafts: Draft[] = [];
  for (let i = 0; i < store.length; i++) {
    const slot = store.key(i);
    if (!slot?.startsWith(prefix)) continue;
    const draft = parseDraft(store.getItem(slot));
    if (draft && workoutDraftSlot(draft.key) === slot) drafts.push(draft);
  }
  return drafts.sort((a, b) => b.started - a.started);
}
