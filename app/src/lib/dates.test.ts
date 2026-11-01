import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, dayKey, fromKey, relDay } from './dates.ts';

test('dayKey and fromKey round-trip without slipping a day', () => {
  for (const k of ['2026-01-01', '2026-03-08', '2026-11-01', '2026-12-31']) assert.equal(dayKey(fromKey(k)), k);
});

test('relative day names', () => {
  const today = fromKey('2026-11-04'); // a Wednesday
  assert.equal(relDay('2026-11-04', today), 'Today');
  assert.equal(relDay('2026-11-05', today), 'Tomorrow');
  assert.equal(relDay('2026-11-03', today), 'Yesterday');
  assert.equal(relDay(dayKey(addDays(today, 3)), today), fromKey('2026-11-07').toLocaleDateString(undefined, { weekday: 'long' }));
  assert.match(relDay('2026-12-25', today), /Dec/);
});
