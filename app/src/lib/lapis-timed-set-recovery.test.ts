import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  elapsedTimedSet, emptyTimedSetClock, pauseTimedSet,
  resetTimedSet, restoreTimedSetClock, resumeTimedSet,
} from '../features/lapis/timed-set-clock';
import { patchDraftTimedSetClock } from '../features/lapis/navigation-recovery';

test('countdown preserves partial time after route blur and resumes at the same position', () => {
  const running = resumeTimedSet(emptyTimedSetClock(60), 1_000_000);
  const paused = pauseTimedSet(running, 1_023_400);
  assert.equal(paused.since, null);
  assert.equal(elapsedTimedSet(paused, 2_000_000), 23.4);
  const resumed = resumeTimedSet(paused, 2_000_000);
  assert.ok(Math.abs(elapsedTimedSet(resumed, 2_020_000) - 43.4) < 0.0001);
});
test('stopwatch persists elapsed time across restart and never auto-runs', () => {
  const running = resumeTimedSet(emptyTimedSetClock(null), 1_000_000);
  const restored = restoreTimedSetClock(running, null, 1_013_000);
  assert.equal(restored.since, null);
  assert.equal(restored.elapsedBefore, 13);
  assert.equal(elapsedTimedSet(restored, 1_100_000), 13);
});
test('recovery is defensive and never silently finishes a countdown', () => {
  const running = resumeTimedSet(emptyTimedSetClock(30), 1_000_000);
  const restored = restoreTimedSetClock(running, 30, 1_100_000);
  assert.deepEqual(restored, { elapsedBefore: 30, since: null, target: 30 });
  assert.deepEqual(restoreTimedSetClock({ ...running, target: 45 }, 30, 1_020_000), emptyTimedSetClock(30));
  assert.deepEqual(restoreTimedSetClock({ elapsedBefore: -1, since: null, target: 30 }, 30, 1_020_000), emptyTimedSetClock(30));
  assert.deepEqual(restoreTimedSetClock({ ...running, since: 5_000_000 }, 30, 1_020_000), emptyTimedSetClock(30));
  assert.deepEqual(resetTimedSet(30), emptyTimedSetClock(30));
});
test('navigation draft checkpoint preserves linked timer states and unrelated data', () => {
  const existing = { key: 'w:abc', log: [], runnerClocks: { interval: { since: null } },
    timedSetClocks: { earlier: { elapsedBefore: 4, since: null, target: null } } };
  const partial = { elapsedBefore: 12, since: null, target: 40 };
  const encoded = patchDraftTimedSetClock(existing, 'w:abc', '2:1:-', partial);
  assert.ok(encoded);
  const decoded = JSON.parse(encoded);
  assert.deepEqual(decoded.timedSetClocks['2:1:-'], partial);
  assert.deepEqual(decoded.runnerClocks, existing.runnerClocks);
  assert.deepEqual(decoded.timedSetClocks.earlier, existing.timedSetClocks.earlier);
  assert.equal(patchDraftTimedSetClock(existing, 'w:wrong', '2:1:-', partial), null);
});
