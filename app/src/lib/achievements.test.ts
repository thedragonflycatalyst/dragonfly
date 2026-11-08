import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findPrs, milestoneText, prText, sessionVolumeKg, streakWeeks, summarize, volumeIn } from './achievements';
import type { PastLog } from './history';
import type { LogEntry } from './model';

const squat = { src: 'lib' as const, id: 'sq', name: 'Back squat' };
const plank = { src: 'lib' as const, id: 'pl', name: 'Plank' };
const pushup = { src: 'lib' as const, id: 'pu', name: 'Push-up' };
const ent = (ex: typeof squat, sets: LogEntry['sets'], unit: 'lb' | 'kg' = 'lb'): LogEntry => ({ block_id: ex.id, ex, sets, unit });
const log = (at: string, entries: LogEntry[]): PastLog => ({ performed_at: at, entries });

test('volume counts weight × reps in kg, both sides, and skips undone sets', () => {
  const v = sessionVolumeKg([ent(squat, [{ weight: 100, reps: 10, done: true }, { weight: 100, reps: 10, done: false }], 'kg'),
    ent(squat, [{ weight: 10, reps_l: 8, reps_r: 8, done: true }], 'kg'), ent(plank, [{ time: 60, done: true }])]);
  assert.equal(v, 1000 + 160);
  assert.equal(Math.round(sessionVolumeKg([ent(squat, [{ weight: 100, reps: 1, done: true }], 'lb')])), 45);
});

test('a heavier set than ever is a record; first time doing it is not', () => {
  const a = log('2026-11-01T10:00:00Z', [ent(squat, [{ weight: 135, reps: 5, done: true }])]);
  assert.deepEqual(findPrs(a, []), []);
  const b = log('2026-11-03T10:00:00Z', [ent(squat, [{ weight: 145, reps: 3, done: true }])]);
  const prs = findPrs(b, [a]);
  assert.equal(prs.length, 1);
  assert.equal(prs[0].kind, 'weight');
  assert.equal(prText(prs[0]), 'Heaviest yet: 145 lb (was 135)');
});

test('equal weight in the other unit is not a false record', () => {
  const a = log('2026-11-01T10:00:00Z', [ent(squat, [{ weight: 100, reps: 5, done: true }], 'kg')]);
  const b = log('2026-11-03T10:00:00Z', [ent(squat, [{ weight: 220.46, reps: 5, done: true }], 'lb')]);
  assert.deepEqual(findPrs(b, [a]), []);
});

test('bodyweight reps and timed holds can be records', () => {
  const a = log('2026-11-01T10:00:00Z', [ent(pushup, [{ reps: 15, done: true }]), ent(plank, [{ time: 45, done: true }])]);
  const b = log('2026-11-02T10:00:00Z', [ent(pushup, [{ reps: 18, done: true }]), ent(plank, [{ time: 60, done: true }])]);
  const prs = findPrs(b, [a]).map((p) => p.kind).sort();
  assert.deepEqual(prs, ['reps', 'time']);
});

test('later sessions are not used as "earlier"', () => {
  const a = log('2026-11-05T10:00:00Z', [ent(squat, [{ weight: 200, reps: 1, done: true }])]);
  const b = log('2026-11-03T10:00:00Z', [ent(squat, [{ weight: 150, reps: 1, done: true }])]);
  const c = log('2026-11-01T10:00:00Z', [ent(squat, [{ weight: 140, reps: 1, done: true }])]);
  assert.equal(findPrs(b, [a, c]).length, 1);
});

test('streak counts consecutive Monday–Sunday weeks back from this one', () => {
  const dates = ['2026-11-04T12:00:00', '2026-10-28T12:00:00', '2026-10-21T12:00:00', '2026-10-07T12:00:00'];
  assert.equal(streakWeeks(dates, '2026-11-04T12:00:00'), 3);
  assert.equal(streakWeeks([], '2026-11-04T12:00:00'), 0);
});

test('summary: session number, month count, previous volume and milestones', () => {
  const logs: PastLog[] = [];
  for (let i = 0; i < 4; i++) logs.push(log(`2026-10-${String(6 + i * 7).padStart(2, '0')}T12:00:00`, [ent(squat, [{ weight: 100, reps: 5, done: true }])]));
  const cur = log('2026-11-03T12:00:00', [ent(squat, [{ weight: 110, reps: 5, done: true }])]);
  const s = summarize(cur, [...logs, cur]);
  assert.equal(s.sessionNumber, 5);
  assert.equal(s.sessionsThisMonth, 1);
  assert.equal(s.streakWeeks, 5);
  assert.equal(s.prevVolumeKg, Math.round(100 * 5 * 0.45359237 * 10) / 10);
  assert.ok(s.milestones.includes('sessions:5'));
  assert.ok(s.milestones.includes('first_pr'));
  assert.ok(!s.milestones.some((m) => m.startsWith('streak:')), '5 weeks is not a streak milestone');
  assert.equal(milestoneText('sessions:1'), 'First session done');
  assert.equal(milestoneText('streak:4'), '4-week streak');
});

test('first ever session', () => {
  const cur = log('2026-11-03T12:00:00', [ent(squat, [{ weight: 95, reps: 8, done: true }])]);
  const s = summarize(cur, [cur]);
  assert.deepEqual(s.milestones, ['sessions:1']);
  assert.equal(s.prevVolumeKg, null);
  assert.equal(s.prs.length, 0);
  assert.equal(volumeIn(s.volumeKg, 'lb'), 760);
});
