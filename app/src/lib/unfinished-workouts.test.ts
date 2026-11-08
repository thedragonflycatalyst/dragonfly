import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { beginWorkoutDraft, discoverWorkoutDrafts, discardWorkoutDraft,
  draftProgress, routeForWorkoutDraft, workoutDraftSlot } from './draft-integrity';
import type { Draft } from './session';
const storage = () => {
  const records = new Map<string, string>();
  return {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => { records.set(key, value); },
    removeItem: (key: string) => { records.delete(key); },
    key: (index: number) => [...records.keys()][index] ?? null,
    get length() { return records.size; },
  };
};
const draft = (key: string, started: number): Draft => ({
  key, title: key, params: {}, client_id: null, started,
  log: [{ block_id: 'a', sets: [{ done: true }, { done: false }] }],
  timerResults: [{ block_id: 'b', timer_id: 'lapis', name: 'Timer', planned_seconds: 20,
    actual_seconds: 20, completed_at: '2026-11-04T10:00:00Z' }],
});
test('unfinished dashboard lists all v2 workouts and one unmigrated legacy draft', () => {
  const s = storage();
  beginWorkoutDraft(s, workoutDraftSlot('w:first'), draft('w:first', 100));
  beginWorkoutDraft(s, workoutDraftSlot('a:second'), draft('a:second', 300));
  s.setItem('dragonfly.session', JSON.stringify(draft('w:legacy', 200)));
  assert.deepEqual(discoverWorkoutDrafts(s).map(d => d.key),
    ['a:second', 'w:legacy', 'w:first']);
});
test('existing v2 snapshot takes precedence over duplicate legacy entry', () => {
  const s = storage();
  beginWorkoutDraft(s, workoutDraftSlot('w:first'), draft('w:first', 300));
  s.setItem('dragonfly.session', JSON.stringify(draft('w:first', 100)));
  assert.equal(discoverWorkoutDrafts(s).length, 1);
  assert.equal(discoverWorkoutDrafts(s)[0].started, 300);
});
test('discarding one draft does not disturb another or its assignment identity', () => {
  const s = storage();
  const a = draft('w:first', 100); const b = draft('a:second', 300);
  b.pendingAssignmentId = 'preserved';
  beginWorkoutDraft(s, workoutDraftSlot(a.key), a);
  beginWorkoutDraft(s, workoutDraftSlot(b.key), b);
  assert.equal(discardWorkoutDraft(s, a.key), true);
  assert.deepEqual(discoverWorkoutDrafts(s).map(d => d.key), [b.key]);
  assert.equal(discoverWorkoutDrafts(s)[0].pendingAssignmentId, 'preserved');
});
test('progress ignores uncompleted sets and counts finished Lapis intervals', () => {
  assert.deepEqual(draftProgress(draft('w:first', 100)),
    { completed: 1, total: 2, intervals: 1, inProgress: false });
});
test('resume route is reconstructed from the saved key, never arbitrary draft params', () => {
  const a = { ...draft('a:id123', 100), params: { workout: 'wrong' } };
  assert.deepEqual(routeForWorkoutDraft(a), { aid: 'id123' });
  assert.deepEqual(routeForWorkoutDraft(draft('w:template', 100)), { workout: 'template' });
});
