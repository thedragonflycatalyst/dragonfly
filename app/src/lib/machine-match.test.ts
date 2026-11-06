import assert from 'node:assert/strict';
import { test } from 'node:test';
import { builtIn } from './library.ts';
import { matchMachine } from './machine-match.ts';

const all = builtIn();
const names = (r: Parameters<typeof matchMachine>[0]) => matchMachine(r, all).map((e) => e.name);

test('named exercises come first, in the order the AI gave them', () => {
  const got = names({ machine: 'Lat pulldown machine', brand: 'Life Fitness', gear: ['Cable machine'], exercises: ['Lat Pulldown', 'Close-Grip Lat Pulldown'] });
  assert.deepEqual(got.slice(0, 2), ['Lat Pulldown', 'Close-Grip Lat Pulldown']);
  assert.ok(got.includes('Reverse-Grip Lat Pulldown'), 'variations of the machine follow');
  assert.ok(got.length <= 20);
  assert.equal(new Set(got).size, got.length, 'no duplicates');
});

test('the word "machine" and unknown names do not block a match', () => {
  const got = names({ machine: 'Leg press machine', brand: '', gear: ['Plate-loaded machine'], exercises: ['Totally Made Up Move', 'Leg Press Machine'] });
  assert.equal(got[0], 'Leg Press');
});

test('falls back to the equipment only when little else matched', () => {
  const got = matchMachine({ machine: '', brand: '', gear: ['Rower'], exercises: [] }, all);
  assert.ok(got.length > 0 && got.every((e) => (e.gear ?? []).includes('Rower')));
  assert.deepEqual(matchMachine({ machine: '', brand: '', gear: ['Machine', 'Bench'], exercises: [] }, all), [], 'broad equipment alone is not enough');
});
