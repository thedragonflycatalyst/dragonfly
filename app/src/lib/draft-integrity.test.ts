import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { clearMatchingDraft, parseDraft, writeDraftCore, writeDraftPatch } from './draft-integrity';
import type { Draft } from './session';
const draft = (key: string): Draft => ({
  key, title: 'Strength', params: { workout: '1' }, client_id: null,
  started: 1000, log: [], runnerClocks: {}, timerResults: [],
});
const store = () => {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    removeItem: () => { value = null; },
  };
};
test('a delayed core snapshot does not erase a newer timer clock', () => {
  const s = store();
  assert.equal(writeDraftCore(s, 'slot', draft('w:1')), true);
  assert.equal(writeDraftPatch(s, 'slot', 'w:1', { runnerClocks: {
    a: { elapsedBefore: 42, since: null, hasStarted: true, skipped: false },
  } }), true);
  assert.equal(writeDraftCore(s, 'slot', { ...draft('w:1'), title: 'Next' }), true);
  const saved = parseDraft(s.getItem());
  assert.equal(saved?.runnerClocks?.a.elapsedBefore, 42);
  assert.equal(saved?.title, 'Next');
});
test('a stale save render cannot remove a persisted assignment UUID', () => {
  const s = store(); writeDraftCore(s, 'slot', draft('w:1'));
  writeDraftPatch(s, 'slot', 'w:1', { pendingAssignmentId: 'uuid-1' });
  writeDraftCore(s, 'slot', { ...draft('w:1'), log: [] });
  assert.equal(parseDraft(s.getItem())?.pendingAssignmentId, 'uuid-1');
});
test('old sessions cannot overwrite, revive, or clear another workout', () => {
  const s = store(); writeDraftCore(s, 'slot', draft('w:new'));
  assert.equal(writeDraftCore(s, 'slot', draft('w:old')), false);
  assert.equal(writeDraftPatch(s, 'slot', 'w:old', { note: 'stale' } as never), false);
  assert.equal(clearMatchingDraft(s, 'slot', 'w:old'), false);
  assert.equal(clearMatchingDraft(s, 'slot', 'w:new'), true);
  assert.equal(writeDraftPatch(s, 'slot', 'w:new', { title: 'late' }), false);
  assert.equal(parseDraft(s.getItem()), null);
});
