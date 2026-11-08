import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blocksBooking, cardText, chargeText, type SessionCharge } from './session-billing';

const base: SessionCharge = { id: 'x', client_id: 'c', booking_id: 'b', on_date: '2026-11-10', starts_at: '2026-11-10T13:00:00Z', status: 'pending',
  client_package_id: null, amount_cents: 8000, currency: 'usd', attempts: 0, last_error: null, note: null };
const before = new Date('2026-11-09T12:00:00Z');

test('session charges read plainly', () => {
  assert.equal(chargeText({ ...base, status: 'package' }, false, before), 'Covered by your package');
  assert.match(chargeText(base, true, before), /charged to your card/);
  assert.match(chargeText(base, false, before), /pay after or buy a package/);
  assert.match(chargeText({ ...base, status: 'due' }, false, before), /^Not paid yet · \$80/);
  assert.match(chargeText({ ...base, attempts: 1, last_error: 'card_declined' }, true, before), /didn’t go through/);
  assert.equal(chargeText({ ...base, status: 'pending', amount_cents: null }, false, before), 'Single session');
  assert.ok(blocksBooking({ ...base, status: 'due' }) && !blocksBooking(base));
  assert.equal(cardText({ brand: 'visa', last4: '4242', exp_month: 4, exp_year: 2028 }), 'Visa ending 4242 · expires 04/28');
});
