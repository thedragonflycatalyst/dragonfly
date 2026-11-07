import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { reminderSeconds } from '../features/lapis/reminder-policy';
import { freshClock, startClock, pauseClock, skipClock } from '../features/lapis/runner-clock';

const startedAt = 1_000_000;
const run = startClock(freshClock(), startedAt, 120);
test('only a running timer outside the foreground schedules a reminder', () => {
  assert.equal(reminderSeconds('background', run, 120, false, startedAt + 20_000), 100);
  assert.equal(reminderSeconds('inactive', run, 120, false, startedAt + 20_000), 100);
  assert.equal(reminderSeconds('active', run, 120, false, startedAt + 20_000), null);
  assert.equal(reminderSeconds(null, run, 120, false, startedAt + 20_000), null);
});
test('pause, skip, another active timer and completion clear reminders', () => {
  assert.equal(reminderSeconds('background', pauseClock(run, startedAt + 30_000, 120), 120, false, startedAt + 50_000), null);
  assert.equal(reminderSeconds('background', skipClock(run, startedAt + 10_000, 60), 120, false, startedAt + 20_000), null);
  assert.equal(reminderSeconds('background', run, 120, true, startedAt + 20_000), null);
  assert.equal(reminderSeconds('background', run, 120, false, startedAt + 120_000), null);
  assert.equal(reminderSeconds('background', freshClock(), 120, false, startedAt), null);
});
