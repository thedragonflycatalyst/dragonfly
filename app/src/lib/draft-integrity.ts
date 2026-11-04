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
