import assert from 'node:assert/strict';
import { healthWord } from '../_shared/messaging.ts';
import { bookedText, nextWave, openText, WAVE_SIZE } from './waitlist.ts';

Deno.test('waitlist messages are clear, short and say nothing about health', () => {
  const a = bookedText('Ana', 'Emmet', 'tomorrow at 7:00 AM');
  const b = openText('Ana', 'Emmet', 'tomorrow at 7:00 AM', 'https://x.example/o/abc');
  assert.ok(a.includes('booked in') && b.includes('https://x.example/o/abc'));
  for (const m of [a, b]) { assert.ok(m.length <= 320); assert.equal(healthWord(m), null); }
});

Deno.test('offers go out 3 at a time in waitlist order, never twice to the same person', () => {
  const w = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((client_id) => ({ client_id }));
  assert.equal(WAVE_SIZE, 3);
  const first = nextWave(w, new Set());
  assert.deepEqual(first.map((x) => x.client_id), ['a', 'b', 'c']);
  const second = nextWave(w, new Set(first.map((x) => x.client_id)));
  assert.deepEqual(second.map((x) => x.client_id), ['d', 'e', 'f']);
  assert.deepEqual(nextWave(w, new Set(['a', 'b', 'c', 'd', 'e', 'f'])).map((x) => x.client_id), ['g']);
  assert.deepEqual(nextWave(w, new Set(w.map((x) => x.client_id))), []);
});
