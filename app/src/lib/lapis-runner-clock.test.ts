import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  elapsedAt, freshClock, pauseClock, skipClock, startClock, validClock,
} from '../features/lapis/runner-clock';

test('running clock catches up after app suspension', () => {
  const start = 1_000_000;
  const clock = startClock(freshClock(), start, 120);
  assert.equal(elapsedAt(clock, start + 90_000, 120), 90);
  assert.equal(elapsedAt(clock, start + 300_000, 120), 120);
});

test('paused clock freezes even after long outage; resume continues from exact offset', () => {
  const start = 1_000_000;
  const running = startClock(freshClock(), start, 120);
  const paused = pauseClock(running, start + 30_000, 120);
  assert.equal(elapsedAt(paused, start + 400_000, 120), 30);
  const resumed = startClock(paused, start + 400_000, 120);
  assert.equal(elapsedAt(resumed, start + 420_000, 120), 50);
});

test('restored state rejects malformed persisted snapshots', () => {
  assert.deepEqual(validClock({ elapsedBefore: -1, since: 1, hasStarted: true, skipped: false }, 120), freshClock());
  assert.deepEqual(validClock({ elapsedBefore: 20, since: null, hasStarted: true, skipped: false }, 120),
    { elapsedBefore: 20, since: null, hasStarted: true, skipped: false });
  assert.deepEqual(validClock({}, 120), freshClock());
});

test('skip moves to the next phase and marks run ineligible for full completion', () => {
  const prior = startClock(freshClock(), 1_000_000, 180);
  const skipped = skipClock(prior, 1_010_000, 60);
  assert.equal(skipped.skipped, true);
  assert.equal(elapsedAt(skipped, 1_010_000, 180), 60);
  assert.equal(elapsedAt(skipped, 1_020_000, 180), 70);
});

test('restarting a completed timer clears prior skip state', () => {
  const prior = { elapsedBefore: 120, since: null, hasStarted: true, skipped: true };
  const restarted = startClock(prior, 2_000_000, 120);
  assert.deepEqual(restarted, { elapsedBefore: 0, since: 2_000_000, hasStarted: true, skipped: false });
});
