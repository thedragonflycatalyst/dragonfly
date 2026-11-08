import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { freshClock, startClock, pauseClock } from '../features/lapis/runner-clock';
import { emptyTimedSetClock, resumeTimedSet } from '../features/lapis/timed-set-clock';
import { recoverLinkedClocks, recoverTimedSetClocks } from '../features/lapis/session-recovery';

test('interrupted interval returns paused and cannot auto-log a missed finish', () => {
  const running = startClock(freshClock(), 1_000_000, 60);
  const clocks = recoverLinkedClocks({ a: running }, { a: 60 }, [], 1_120_000);
  assert.equal(clocks.a.since, null);
  assert.equal(clocks.a.elapsedBefore, 59);
  assert.equal(clocks.a.hasStarted, true);
});
test('a saved completed interval remains completed without resuming its clock', () => {
  const finished = pauseClock(startClock(freshClock(), 1_000_000, 60), 1_060_000, 60);
  const clocks = recoverLinkedClocks({ a: finished }, { a: 60 }, ['a'], 2_000_000);
  assert.equal(clocks.a.elapsedBefore, 60);
  assert.equal(clocks.a.since, null);
});
test('paused partial intervals retain progress; deleted blocks are ignored', () => {
  const paused = pauseClock(startClock(freshClock(), 1_000_000, 120), 1_041_000, 120);
  const clocks = recoverLinkedClocks({ a: paused, missing: paused }, { a: 120 }, [], 2_000_000);
  assert.equal(clocks.a.elapsedBefore, 41);
  assert.equal('missing' in clocks, false);
});
test('individual exercise countdowns and stopwatches restore paused', () => {
  const clock = resumeTimedSet(emptyTimedSetClock(60), 1_000_000);
  const stopwatch = resumeTimedSet(emptyTimedSetClock(null), 1_000_000);
  const result = recoverTimedSetClocks({ a: clock, b: stopwatch }, 1_010_000);
  assert.equal(result.a.since, null);
  assert.equal(result.a.elapsedBefore, 10);
  assert.equal(result.b.since, null);
  assert.equal(result.b.elapsedBefore, 10);
});
