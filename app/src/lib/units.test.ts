import assert from 'node:assert/strict';
import { test } from 'node:test';
import { age, cmToFtIn, fmtHeight, fmtLength, fmtWeight, ftInToCm, num, showWeight, toCm, toKg } from './units.ts';

test('weights round-trip between lb and kg', () => {
  assert.equal(toKg('150', 'imperial'), 68.04);
  assert.equal(showWeight(68.04, 'imperial'), 150);
  assert.equal(fmtWeight(68.04, 'imperial'), '150 lb');
  assert.equal(fmtWeight(68.04, 'metric'), '68 kg');
  assert.equal(toKg('68,5', 'metric'), 68.5);
});

test('heights in feet and inches', () => {
  assert.deepEqual(cmToFtIn(ftInToCm(5, 6)), { ft: 5, in: 6 });
  assert.deepEqual(cmToFtIn(182.88), { ft: 6, in: 0 });
  assert.deepEqual(cmToFtIn(182.6), { ft: 6, in: 0 }); // 71.9 in rounds up to 6 ft, never "5 ft 12 in"
  assert.equal(fmtHeight(167.6, 'imperial'), '5 ft 6 in');
  assert.equal(fmtHeight(167.6, 'metric'), '168 cm');
});

test('lengths and typed numbers', () => {
  assert.equal(toCm('30', 'imperial'), 76.2);
  assert.equal(fmtLength(76.2, 'imperial'), '30 in');
  for (const bad of ['', ' ', 'abc', '1.2.3', '5ft']) assert.equal(num(bad), null, bad);
  assert.equal(num(' 12.5 '), 12.5);
  assert.equal(num('.5'), 0.5);
});

test('age on and around a birthday', () => {
  const today = new Date(2026, 10, 1); // Nov 1, 2026
  assert.equal(age('1990-11-01', today), 36);
  assert.equal(age('1990-11-02', today), 35);
  assert.equal(age('not a date', today), null);
});
