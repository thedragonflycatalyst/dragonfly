import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pastSwaps, type PastLog } from './history.ts';

test('past swaps: what this person usually swaps to, most often first', () => {
  const sq = { src: 'lib' as const, id: 'c-back-squat', name: 'Back Squat' };
  const lp = { src: 'lib' as const, id: 'c-leg-press', name: 'Leg Press' }, gs = { src: 'lib' as const, id: 'c-goblet-squat', name: 'Goblet Squat' };
  const past: PastLog[] = [
    { performed_at: '2026-11-01', entries: [{ block_id: 'a', ex: lp, sets: [], swapped_from_ref: 'lib:c-back-squat', swapped_from: 'Back Squat' }] },
    { performed_at: '2026-10-25', entries: [{ block_id: 'a', ex: gs, sets: [], swapped_from: 'back squat' }, { block_id: 'b', ex: sq, sets: [] }] },
    { performed_at: '2026-10-18', entries: [{ block_id: 'a', ex: lp, sets: [], swapped_from_ref: 'lib:c-back-squat' }] },
    { performed_at: '2026-10-11', entries: [{ block_id: 'a', ex: lp, sets: [], swapped_from_ref: 'lib:c-front-squat', swapped_from: 'Back Squat' }] },
  ];
  assert.deepEqual(pastSwaps(past, 'lib:c-back-squat', 'Back Squat'), [
    { ref: 'lib:c-leg-press', name: 'Leg Press', uses: 2 }, { ref: 'lib:c-goblet-squat', name: 'Goblet Squat', uses: 1 }]);
  assert.deepEqual(pastSwaps(past, 'lib:c-deadlift', 'Deadlift'), []);
});
