import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyOf, notesOf, ghostSet } from './history';
import { isTwoSided, repsOf, sidesText, usesSides, weakSide } from './sides';

test('isTwoSided spots one-side-at-a-time moves', () => {
  for (const n of ['Single arm cable curl', 'Single-Leg RDL', 'One Arm Dumbbell Row', 'Bulgarian split squat', 'Side plank', 'Suitcase carry', 'Step-ups', 'Curl (each arm)'])
    assert.equal(isTwoSided(n), true, n);
  for (const n of ['Barbell back squat', 'Cable curl', 'Plank', 'Farmers carry', 'Walking lunge']) assert.equal(isTwoSided(n), false, n);
  assert.equal(usesSides(false, 'Single arm row'), false);
  assert.equal(usesSides(true, 'Squat'), true);
});

test('weakSide and totals', () => {
  assert.deepEqual(weakSide(8, 10), { side: 'L', by: 2 });
  assert.deepEqual(weakSide(10, 9), { side: 'R', by: 1 });
  assert.equal(weakSide(10, 10), null);
  assert.equal(weakSide(null, 10), null);
  assert.equal(repsOf({ done: true, reps_l: 8, reps_r: 10 }), 18);
  assert.equal(repsOf({ done: true, reps: 12 }), 12);
  assert.equal(sidesText(8, 10), '10 R · 8 L');
});

test('history: newest first, notes in order, ghost sets', () => {
  const ex = { src: 'lib' as const, id: 'curl', name: 'Curl' };
  const logs = [
    { performed_at: '2026-10-01T10:00:00Z', entries: [{ block_id: 'a', ex, sets: [{ done: true, weight: 20, reps: 10 }], note: 'Old note' }] },
    { performed_at: '2026-10-20T10:00:00Z', entries: [{ block_id: 'a', ex, sets: [{ done: true, weight: 25, reps_l: 8, reps_r: 10 }], note: '  ' }] },
    { performed_at: '2026-10-10T10:00:00Z', entries: [{ block_id: 'b', ex: { ...ex, id: 'row' }, sets: [] }, { block_id: 'a', ex, sets: [{ done: true, weight: 22, reps: 9 }, { done: true, weight: 22, reps: 8 }], note: 'Left elbow sore' }] },
  ];
  const h = historyOf(logs, 'lib:curl');
  assert.deepEqual(h.map((t) => t.at.slice(0, 10)), ['2026-10-20', '2026-10-10', '2026-10-01']);
  assert.deepEqual(notesOf(h).map((n) => n.note), ['Left elbow sore', 'Old note']);
  assert.equal(ghostSet(h, 0)?.weight, 25);
  assert.equal(ghostSet(h, 3)?.reps_r, 10);
  assert.equal(ghostSet([], 0), null);
});

test('setLine shows both sides and who fell short', async () => {
  const { setLine } = await import('./history');
  assert.equal(setLine({ done: true, weight: 25, reps_l: 8, reps_r: 10 }, 'lb'), '25 lb × 10 R · 8 L reps (left 2 short)');
  assert.equal(setLine({ done: true, weight: 25, reps: 10 }, 'lb'), '25 lb × 10 reps');
  assert.equal(setLine({ done: true, time_l: 40, time_r: 45 }), '0:45 R · 0:40 L');
});
