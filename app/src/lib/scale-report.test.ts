import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canShareProgress, progressShareText, scaleProgress } from './scale-report';

const entry = (day: string, kg: number) => ({ measured_at: day + 'T12:00:00.000Z', weight_kg: kg });
const now = new Date('2026-11-04T23:00:00Z');

test('progress snapshot uses weighed endpoints within the chosen period', () => {
  const data = [entry('2026-08-20', 110), entry('2026-10-10', 105),
    entry('2026-11-03', 100), entry('2026-11-04', 99)];
  const p = scaleProgress(data, 30, 90, now)!;
  assert.equal(p.count, 3);
  assert.equal(p.startKg, 105);
  assert.equal(p.endKg, 99);
  assert.equal(p.changeKg, -6);
  assert.ok(Math.abs(p.changePct - (-6 / 105 * 100)) < 0.001);
  assert.equal(p.goalKg, 90);
  assert.equal(p.rangeLabel, 'Last 30 days');
  assert.match(progressShareText(p, 'kg'), /Change: −6.0 kg \(−5.7%\)/);
});

test('empty and one-reading periods never fabricate changes', () => {
  const data = [entry('2026-08-20', 110), entry('2026-11-04', 99)];
  assert.equal(scaleProgress(data, 5, null, new Date('2026-10-05T10:00:00Z')), null);
  const p = scaleProgress(data, 7, null, now)!;
  assert.equal(p.count, 1);
  assert.equal(p.changeKg, 0);
  assert.match(progressShareText(p, 'lb'), /Change: Not enough measurements/);
  assert.doesNotMatch(progressShareText(p, 'lb'), /Goal:/);
});

test('all-history snapshot sorts unsorted rows and skips future/invalid readings', () => {
  const data = [entry('2026-11-04', 95), entry('2026-09-01', 100),
    entry('2026-11-10', 80), entry('2026-10-01', -4)];
  const p = scaleProgress(data, null, null, now)!;
  assert.equal(p.count, 2);
  assert.equal(p.startKg, 100);
  assert.equal(p.endKg, 95);
  assert.equal(p.changeKg, -5);
  assert.equal(p.rangeLabel, 'All recorded history');
});

test('share text respects preferred units and comma decimal formatting', () => {
  const p = scaleProgress([entry('2026-11-01', 100), entry('2026-11-04', 99)], null, 90, now)!;
  const text = progressShareText(p, 'lb', 'comma', true);
  assert.match(text, /Starting weight: 220,5 lbs/);
  assert.match(text, /Latest weight: 218,3 lbs/);
  assert.match(text, /Goal: 198,4 lbs/);
  assert.doesNotMatch(text, /user_id|email|phone/i);
});

test('goal is shared only when they include it (L-021)', () => {
  const p = scaleProgress([entry('2026-11-01', 100), entry('2026-11-04', 99)], null, 90, now)!;
  assert.doesNotMatch(progressShareText(p, 'kg'), /Goal|Distance to goal/);
  assert.match(progressShareText(p, 'kg', 'dot', true), /Goal: 90.0 kg/);
});

test('trainers viewing a client read-only cannot share their progress (L-020)', () => {
  const p = scaleProgress([entry('2026-11-01', 100), entry('2026-11-04', 99)], null, 90, now)!;
  assert.equal(canShareProgress(true, p), false);
  assert.equal(canShareProgress(false, p), true);
  assert.equal(canShareProgress(undefined, p), true);
  assert.equal(canShareProgress(false, null), false);
});
