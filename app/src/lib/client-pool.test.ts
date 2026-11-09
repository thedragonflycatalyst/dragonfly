import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectiveTier, fitsWindow, offerExpiry, rankPool, type PoolClient } from './client-pool';

const now = new Date(2026, 10, 9, 8, 0); // Mon 9 Nov 2026 08:00 local
const slot = new Date(2026, 10, 10, 7, 0); // Tue 07:00
const c = (id: string, tier: PoolClient['frequency_tier'], extra: Partial<PoolClient> = {}): PoolClient => ({ id, name: id, status: 'active', frequency_tier: tier, short_notice_ok: false, ...extra });
const ago = (d: number) => new Date(now.getTime() - d * 86400_000).toISOString();

test('fits only when the whole slot is inside a window on that weekday', () => {
  const w = [{ client_id: 'a', weekday: 2, start_time: '06:00', end_time: '08:00' }];
  assert.equal(fitsWindow(w, slot, 60), true);
  assert.equal(fitsWindow(w, slot, 90), false);
  assert.equal(fitsWindow(w, new Date(2026, 10, 11, 7, 0), 60), false);
});

test('regular clients who stop coming show as lapsed', () => {
  assert.equal(effectiveTier(c('a', 'regular'), ago(40), now), 'lapsed');
  assert.equal(effectiveTier(c('a', 'regular'), ago(5), now), 'regular');
  assert.equal(effectiveTier(c('a', 'prospect'), ago(100), now), 'prospect');
});

test('ranking: free then, opted in, longest since last, most credits; regulars, inactive and busy left out', () => {
  const clients = [c('reg', 'regular'), c('fits', 'occasional'), c('optin', 'on_call', { short_notice_ok: true }), c('old', 'occasional'),
    c('paused', 'occasional', { status: 'paused' }), c('busy', 'on_call')];
  const windows = [{ client_id: 'fits', weekday: 2, start_time: '06:00', end_time: '09:00' }];
  const r = rankPool({ clients, windows, lastSeen: { reg: ago(2), fits: ago(3), optin: ago(10), old: ago(20) }, credits: { old: 4 },
    start: slot, durationMin: 60, now, busy: new Set(['busy']) });
  assert.deepEqual(r.map((x) => x.client.id), ['fits', 'optin', 'old']);
  assert.ok(r[0].why.includes('Usually free then'));
  const withRegs = rankPool({ clients, windows, lastSeen: { reg: ago(2) }, credits: {}, start: slot, durationMin: 60, now, includeRegulars: true });
  assert.ok(withRegs.some((x) => x.client.id === 'reg'));
});

test('clients away on the slot day are not offered it', () => {
  const clients = [c('away', 'on_call', { away_reason: 'injury', away_until: '2026-11-20' }), c('later', 'on_call', { away_reason: 'travel', away_from: '2026-11-15' }),
    c('backtoday', 'on_call', { away_reason: 'travel', away_until: '2026-11-09' })];
  const r = rankPool({ clients, windows: [], lastSeen: {}, credits: {}, start: slot, durationMin: 60, now });
  assert.deepEqual(r.map((x) => x.client.id).sort(), ['backtoday', 'later']);
});

test('offer expiry is an hour before, never in the past', () => {
  assert.equal(offerExpiry(slot, now).getTime(), slot.getTime() - 3600_000);
  const soon = new Date(now.getTime() + 30 * 60_000);
  assert.ok(offerExpiry(soon, now) > now && offerExpiry(soon, now) <= soon);
});
