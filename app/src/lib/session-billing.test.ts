import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blocksBooking, canRefund, cardText, chargeText, refundPlan, type SessionCharge } from './session-billing';

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

test('refunding a session says what will happen', () => {
  const c = { id: 'c', client_id: 'x', booking_id: null, on_date: '2026-11-12', starts_at: '2026-11-12T15:00:00Z', status: 'paid', client_package_id: null,
    amount_cents: 8000, currency: 'usd', attempts: 0, last_error: null, note: null } as SessionCharge;
  assert.match(refundPlan(c, 'stripe'), /\$80 goes back to their card/);
  assert.match(refundPlan(c, 'cash'), /Records that you gave \$80 back \(it was paid by cash\)/);
  assert.match(refundPlan({ ...c, status: 'package' }, null), /back on their package/);
  assert.match(refundPlan({ ...c, status: 'due' }, null), /nothing will be owed/);
  assert.equal(canRefund({ ...c, status: 'refunded' }), false);
  assert.equal(canRefund({ ...c, status: 'cancelled' }), false);
  assert.equal(chargeText({ ...c, status: 'refunded' }, false), 'Refunded · $80');
  assert.equal(chargeText({ ...c, status: 'refunded', client_package_id: 'p' }, false), 'Refunded: the session went back on your package');
});
