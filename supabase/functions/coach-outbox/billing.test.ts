import assert from 'node:assert/strict';
import { chargeDescription, MAX_ATTEMPTS } from './billing.ts';

Deno.test('card charges are described plainly and retried a limited number of times', () => {
  assert.equal(chargeDescription('2026-11-10', 'Emmet'), 'Training session Nov 10 with Emmet');
  assert.ok(MAX_ATTEMPTS >= 1 && MAX_ATTEMPTS <= 3);
});
