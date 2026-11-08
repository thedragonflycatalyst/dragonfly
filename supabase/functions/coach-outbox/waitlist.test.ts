import assert from 'node:assert/strict';
import { healthWord } from '../_shared/messaging.ts';
import { bookedText, openText } from './waitlist.ts';

Deno.test('waitlist messages are clear, short and say nothing about health', () => {
  const a = bookedText('Ana', 'Emmet', 'tomorrow at 7:00 AM');
  const b = openText('Ana', 'Emmet', 'tomorrow at 7:00 AM', 'https://x.example/o/abc');
  assert.ok(a.includes('booked in') && b.includes('https://x.example/o/abc'));
  for (const m of [a, b]) { assert.ok(m.length <= 320); assert.equal(healthWord(m), null); }
});
