import assert from 'node:assert/strict';
import { test } from 'node:test';
import { byUrgency, dueLabel, nextDue, signals } from './checkins';

test('next check-in: rhythm from the last one, follow-ups win, pauses show', () => {
  const t = '2026-11-02';
  assert.deepEqual(nextDue({ last: { done_on: '2026-10-20', follow_up_on: null }, started: '2026-09-01', plan: null, defaultDays: 14, today: t }), { due: '2026-11-03', status: 'soon', days: 1 });
  assert.equal(nextDue({ last: null, started: '2026-10-01', plan: null, defaultDays: 14, today: t }).status, 'overdue');
  assert.equal(nextDue({ last: { done_on: '2026-10-26', follow_up_on: null }, started: '2026-09-01', plan: { every_days: 7, paused: false }, defaultDays: 14, today: t }).status, 'today');
  assert.equal(nextDue({ last: { done_on: '2026-11-01', follow_up_on: '2026-11-20' }, started: '2026-09-01', plan: null, defaultDays: 3, today: t }).due, '2026-11-20');
  const paused = nextDue({ last: null, started: '2026-01-01', plan: { every_days: 7, paused: true }, defaultDays: 14, today: t });
  assert.equal(paused.status, 'paused'); assert.equal(dueLabel(paused), 'Paused');
  assert.equal(dueLabel({ due: '', status: 'overdue', days: -1 }), '1 day overdue');
  assert.equal(dueLabel({ due: '', status: 'soon', days: 2 }), 'Due in 2 days');
  const list = [paused, { due: '', status: 'soon' as const, days: 2 }, { due: '', status: 'overdue' as const, days: -5 }].sort(byUrgency);
  assert.deepEqual(list.map((d) => d.status), ['overdue', 'soon', 'paused']);
});

test('signals: missed workouts, quiet stretches, and wins', () => {
  const t = '2026-11-02';
  const s = signals({ scheduled: [{ scheduled_on: '2026-10-28', status: 'scheduled' }, { scheduled_on: '2026-10-30', status: 'scheduled' }, { scheduled_on: '2026-11-04', status: 'scheduled' }],
    lastWorkout: '2026-10-15', lastFood: '2026-10-25', lastWeigh: '2026-09-01' }, t);
  assert.deepEqual(s.map((x) => x.text), ['Missed 2 workouts', 'No workout in 18 days', 'No food logged in 8 days', 'Last weigh-in 62 days ago']);
  const good = signals({ scheduled: [1, 2, 3].map((d) => ({ scheduled_on: `2026-10-2${d}`, status: 'done' })), lastWorkout: '2026-10-23', lastFood: '2026-11-02', lastWeigh: null }, t);
  assert.deepEqual(good.map((x) => x.level), ['good', 'good']);
  assert.deepEqual(signals({ scheduled: [], lastWorkout: null, lastFood: null, lastWeigh: null }, t), []);
});
