import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { freshClock, startClock } from '../features/lapis/runner-clock';
import { pauseForNavigation, patchDraftClock } from '../features/lapis/navigation-recovery';

test('leaving a workout freezes the active timer at the correct position', () => {
  const running = startClock(freshClock(), 1_000_000, 120);
  const paused = pauseForNavigation(running, 1_045_000, 120);
  assert.equal(paused.elapsedBefore, 45);
  assert.equal(paused.since, null);
  assert.deepEqual(pauseForNavigation(paused, 1_085_000, 120), paused);
});
test('only update the matching draft and preserve unrelated workout data', () => {
  const raw = { key: 'a:123', title: 'Strength', log: [{ block_id: 'squat' }],
    runnerClocks: { other: freshClock() }, note: 'keep me' };
  const clock = pauseForNavigation(startClock(freshClock(), 1_000_000, 120), 1_023_000, 120);
  const result = patchDraftClock(raw, 'a:123', 'lapis-row', clock);
  assert.ok(result);
  const updated = JSON.parse(result);
  assert.equal(updated.runnerClocks['lapis-row'].elapsedBefore, 23);
  assert.deepEqual(updated.runnerClocks.other, freshClock());
  assert.equal(updated.note, 'keep me');
  assert.equal(patchDraftClock(raw, 'a:other', 'lapis-row', clock), null);
  assert.equal(patchDraftClock(null, 'a:123', 'lapis-row', clock), null);
});
