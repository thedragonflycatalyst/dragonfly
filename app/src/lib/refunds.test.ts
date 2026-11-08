import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_TERMS, policyText, quoteText, toCentsInput } from './refunds';

test('policy wording says what is and isn’t refundable', () => {
  const t = policyText({ ...DEFAULT_TERMS, mode: 'prorated', fee_cents: 500 });
  assert.match(t[0], /within 30 days of purchase for the sessions you haven’t used/);
  assert.match(t[0], /\$5 processing fee/);
  assert.match(t[1], /Not refundable: sessions already used.*expired packages/);
  assert.deepEqual(policyText({ ...DEFAULT_TERMS, mode: 'none' }), ['All sales are final: refunds aren’t given, except in exceptional circumstances at your trainer’s discretion.', 'If your trainer cancels a session, it’s credited back to you.']);
  assert.equal(DEFAULT_TERMS.mode, 'none');
  assert.match(policyText({ ...DEFAULT_TERMS, mode: 'unused_only', window_days: 0 })[0], /in full on the day of purchase only if no sessions have been used/);
});

test('quote lines', () => {
  assert.equal(quoteText({ refundable: true, reason: null, max_cents: 60000, suggested_cents: 35500, credits_total: 10, credits_unused: 6, fee_cents: 500 }),
    'Policy refund: $355 · 6 of 10 sessions unused · minus $5 fee');
  assert.equal(quoteText({ refundable: false, reason: 'The package has expired.', max_cents: 60000, suggested_cents: 0 }), 'Not refundable under your policy: The package has expired.');
});

test('amount input', () => {
  assert.equal(toCentsInput('355'), 35500);
  assert.equal(toCentsInput('$12.5'), 1250);
  assert.equal(toCentsInput('12.345'), null);
  assert.equal(toCentsInput('abc'), null);
});
