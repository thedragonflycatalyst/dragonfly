import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { activeWorkoutTimers, clearTimerCompletion, recordTimerCompletion, shouldAcceptTimedSetCompletion } from '../features/lapis/completion-integrity';
import { freshClock, startClock, pauseClock } from '../features/lapis/runner-clock';
import { emptyTimedSetClock, resumeTimedSet, pauseTimedSet } from '../features/lapis/timed-set-clock';

const result = { block_id: 'interval-1', timer_id: 'lapis-id',
  name: 'Intervals', planned_seconds: 60, actual_seconds: 60, completed_at: '2026-11-04T10:00:00Z' };

test('completed runs deduplicate and outdated callbacks cannot overwrite the newer result', () => {
  const stored = recordTimerCompletion([], result);
  assert.equal(stored.length, 1);
  assert.equal(recordTimerCompletion(stored, result), stored);
  assert.equal(recordTimerCompletion(stored, { ...result, completed_at: '2026-11-04T09:59:59Z' }), stored);
  const newer = recordTimerCompletion(stored, { ...result, actual_seconds: 61, completed_at: '2026-11-04T10:00:01Z' });
  assert.equal(newer.length, 1);
  assert.equal(newer[0].actual_seconds, 61);
  assert.equal(clearTimerCompletion(newer, result.block_id).length, 0);
});
test('malformed timer completions never enter a workout log', () => {
  assert.deepEqual(recordTimerCompletion([], { ...result, actual_seconds: Number.NaN }), []);
  assert.deepEqual(recordTimerCompletion([], { ...result, completed_at: 'not a date' }), []);
});
test('saving is blocked by running linked or timed-set clocks, including stale owners', () => {
  const running = startClock(freshClock(), 100000, 60);
  const stopped = pauseClock(running, 120000, 60);
  const timed = resumeTimedSet(emptyTimedSetClock(20), 100000);
  assert.equal(activeWorkoutTimers({ first: running }, {}, null, null), true);
  assert.equal(activeWorkoutTimers({}, { set: timed }, null, null), true);
  assert.equal(activeWorkoutTimers({}, {}, 'interval', null), true);
  assert.equal(activeWorkoutTimers({}, {}, null, 'set'), true);
  assert.equal(activeWorkoutTimers({ first: stopped }, { set: pauseTimedSet(timed, 110000) }, null, null), false);
});
test('timed sets only complete on a positive finite duration and when unfinished', () => {
  assert.equal(shouldAcceptTimedSetCompletion(false, 14), true);
  assert.equal(shouldAcceptTimedSetCompletion(true, 14), false);
  assert.equal(shouldAcceptTimedSetCompletion(false, 0), false);
  assert.equal(shouldAcceptTimedSetCompletion(false, Infinity), false);
});
