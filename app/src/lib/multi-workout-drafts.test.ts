import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  beginWorkoutDraft, clearMatchingDraft, loadWorkoutDraft, listWorkoutDrafts,
  parseDraft, workoutDraftSlot, writeDraftCore, writeDraftPatch,
} from './draft-integrity';
import type { Draft } from './session';
function store() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, value: string) => { map.set(k, value); },
    removeItem: (k: string) => { map.delete(k); },
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}
function sample(key: string, started = 1000): Draft {
  return { key, title: 'Workout ' + key, params: { workout: key },
    client_id: null, started, log: [], runnerClocks: {},
    timedSetClocks: {}, restClock: null, timerResults: [],
    pendingAssignmentId: null };
}
test('two unfinished workouts keep independent logs, timers and rest', () => {
  const s = store(), a = workoutDraftSlot('w:alpha'), b = workoutDraftSlot('w:beta');
  beginWorkoutDraft(s, a, sample('w:alpha'));
  beginWorkoutDraft(s, b, sample('w:beta', 2000));
  writeDraftPatch(s, a, 'w:alpha', { runnerClocks: {
    lapis: { since: null, elapsedBefore: 15, hasStarted: true, skipped: false },
  }, restClock: { until: 60000, total: 60, label: 'Next', pausedLeft: 28, nextSetKey: '0:1:-' } });
  writeDraftPatch(s, b, 'w:beta', { timedSetClocks: {
    '0:0:-': { elapsedBefore: 7, since: null, target: 30 },
  } });
  assert.equal(loadWorkoutDraft(s, 'w:alpha')?.runnerClocks?.lapis.elapsedBefore, 15);
  assert.equal(loadWorkoutDraft(s, 'w:alpha')?.restClock?.pausedLeft, 28);
  assert.equal(loadWorkoutDraft(s, 'w:beta')?.timedSetClocks?.['0:0:-'].elapsedBefore, 7);
  assert.equal(clearMatchingDraft(s, a, 'w:alpha'), true);
  assert.equal(loadWorkoutDraft(s, 'w:beta')?.title, 'Workout w:beta');
  assert.equal(loadWorkoutDraft(s, 'w:alpha'), null);
  assert.deepEqual(listWorkoutDrafts(s).map(d => d.key), ['w:beta']);
});
test('legacy single-slot draft migrates once and preserves every field', () => {
  const s = store(); const legacy = sample('a:assigned');
  legacy.pendingAssignmentId = 'stable-uuid';
  legacy.restClock = { until: 45000, total: 45, label: 'Next', pausedLeft: 33, nextSetKey: null };
  s.setItem('dragonfly.session', JSON.stringify(legacy));
  const recovered = loadWorkoutDraft(s, 'a:assigned');
  assert.equal(recovered?.pendingAssignmentId, 'stable-uuid');
  assert.equal(recovered?.restClock?.pausedLeft, 33);
  assert.equal(s.getItem('dragonfly.session'), null);
  assert.deepEqual(loadWorkoutDraft(s, 'a:assigned'), recovered);
});
test('migration never overwrites a newer per-workout draft or deletes another legacy workout', () => {
  const s = store();
  s.setItem('dragonfly.session', JSON.stringify(sample('w:old')));
  beginWorkoutDraft(s, workoutDraftSlot('w:old'), { ...sample('w:old'), title: 'Newer' });
  assert.equal(loadWorkoutDraft(s, 'w:old')?.title, 'Newer');
  assert.equal(parseDraft(s.getItem('dragonfly.session'))?.title, 'Workout w:old');
  assert.equal(loadWorkoutDraft(s, 'w:another'), null);
  assert.equal(parseDraft(s.getItem('dragonfly.session'))?.key, 'w:old');
});
test('stale cross-session callbacks cannot overwrite or recreate completed workouts', () => {
  const s = store(), a = workoutDraftSlot('w:1'), b = workoutDraftSlot('w:2');
  beginWorkoutDraft(s, a, sample('w:1')); beginWorkoutDraft(s, b, sample('w:2'));
  assert.equal(writeDraftPatch(s, a, 'w:2', { title: 'Oops' }), false);
  clearMatchingDraft(s, a, 'w:1');
  assert.equal(writeDraftPatch(s, a, 'w:1', { title: 'Late callback' }), false);
  writeDraftCore(s, b, { ...sample('w:2'), title: 'Still open' });
  assert.equal(loadWorkoutDraft(s, 'w:2')?.title, 'Still open');
});
test('workout keys are collision-safe and invalid keys are rejected', () => {
  assert.notEqual(workoutDraftSlot('w:a/b'), workoutDraftSlot('w:a:b'));
  assert.throws(() => workoutDraftSlot(''));
});
