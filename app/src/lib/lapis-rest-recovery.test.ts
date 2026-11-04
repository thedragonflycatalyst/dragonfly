import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  addRestSeconds, createRestClock, pauseRestClock, restRemaining,
  restoreRestClock, resumeRestClock,
} from '../features/lapis/rest-clock';
import { patchDraftRestClock } from '../features/lapis/navigation-recovery';

const base = 1_000_000;
test('rest draft stores the next timed set as a key, not a callback', () => {
  const rest = createRestClock(90, 'Next: set 2', '2:1:r', base);
  assert.equal(rest.nextSetKey, '2:1:r');
  assert.equal(rest.until, base + 90_000);
  assert.doesNotThrow(() => JSON.stringify(rest));
});
test('return after leaving the workout restores the exact remaining time, paused', () => {
  const running = createRestClock(60, 'Next', '2:1:-', base);
  const paused = pauseRestClock(running, base + 12_500);
  assert.ok(paused);
  assert.equal(paused.pausedLeft, 47.5);
  const restored = restoreRestClock(paused, base + 9_000_000);
  assert.ok(restored);
  assert.equal(restored.pausedLeft, 47.5);
  assert.equal(restored.nextSetKey, '2:1:-');
  const resumed = resumeRestClock(restored, base + 10_000_000);
  assert.ok(resumed);
  assert.equal(restRemaining(resumed, base + 10_022_000), 25.5);
});
test('background-expired rest never auto-runs on draft hydration', () => {
  const rest = createRestClock(30, 'Next', '0:1:-', base);
  assert.equal(restoreRestClock(rest, base + 90_000), null);
  const restoredActive = restoreRestClock(rest, base + 10_000);
  assert.ok(restoredActive);
  assert.equal(restoredActive.pausedLeft, 20);
  assert.equal(restoreRestClock({ ...rest, nextSetKey: () => {} }, base), null);
});
test('manual rest adjustments keep the next set target and paused state', () => {
  const rest = pauseRestClock(createRestClock(60, 'Next', '3:0:-', base), base + 10_000);
  const adjusted = addRestSeconds(rest, 15, base + 100_000);
  assert.ok(adjusted);
  assert.equal(adjusted.total, 75);
  assert.equal(adjusted.pausedLeft, 65);
  assert.equal(adjusted.nextSetKey, '3:0:-');
});
test('rest checkpoint only updates matching workout draft', () => {
  const original = { key: 'a:session', log: [], timerResults: [{ block_id: 'lapis' }] };
  const rest = pauseRestClock(createRestClock(60, '', null, base), base + 9_000);
  const next = patchDraftRestClock(original, 'a:session', rest);
  assert.ok(next);
  const parsed = JSON.parse(next);
  assert.deepEqual(parsed.timerResults, original.timerResults);
  assert.equal(parsed.restClock.pausedLeft, 51);
  assert.equal(patchDraftRestClock(original, 'a:different', rest), null);
});
