import assert from 'node:assert/strict';
import { test } from 'node:test';
import { builtIn } from './library.ts';
import { MACHINES } from '../data/machines.ts';
import { findMachines, machineMatches, matchMachine } from './machine-match.ts';

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

test('every variation of the machine shows, and unknown moves are listed apart', () => {
  const r = machineMatches({ machine: 'Leg press', brand: '', gear: ['Plate-loaded machine'], exercises: ['Leg Press', 'High Foot Leg Press', 'Leg Press Calf Raise', 'Leg Press Donkey Kick'] }, all);
  const got = r.list.map((e) => e.name);
  for (const n of ['Leg Press', 'High Foot Leg Press', 'Leg Press Calf Raise', 'Low Foot Leg Press', 'Wide Stance Leg Press', 'Single-Leg Leg Press']) assert.ok(got.includes(n), n);
  assert.deepEqual(r.extra, ['Leg Press Donkey Kick']);
});

test('every machine in the catalog lists real library exercises', () => {
  const names = new Set(all.map((e) => e.name));
  for (const m of MACHINES) {
    for (const n of m.ex) assert.ok(names.has(n), `${m.id}: ${n}`);
    const got = matchMachine({ id: m.id, machine: m.name, brand: '', gear: [], exercises: [] }, all);
    assert.ok(got.length >= 1, `${m.id} finds nothing`);
    assert.deepEqual(got.slice(0, m.ex.length).map((e) => e.name), m.ex, `${m.id} keeps its order`);
  }
  assert.equal(new Set(MACHINES.map((m) => m.id)).size, MACHINES.length, 'ids are unique');
});

test('a scanned V-squat brings up facing the pad and calf raises too', () => {
  const got = names({ id: 'v-squat', machine: 'Power squat', brand: '', gear: [], exercises: [] });
  assert.deepEqual(got, ['V-Squat Machine', 'Reverse V-Squat', 'V-Squat Calf Raise']);
  const smith = names({ id: 'smith', machine: 'Smith machine', brand: '', gear: [], exercises: [] });
  assert.ok(smith.length >= 20 && smith.includes('Smith Machine Squat'));
});

test('home gyms can be typed in by brand or model', () => {
  assert.equal(findMachines('centr')[0]?.id, 'home-functional-trainer');
  assert.equal(findMachines('Centr 1 Home Gym Functional Trainer')[0]?.id, 'home-functional-trainer');
  assert.equal(findMachines('bowflex xtreme')[0]?.id, 'home-power-rod');
  assert.ok(findMachines('bowflex').some((m) => m.id === 'adjustable-dumbbells'));
  assert.equal(findMachines('total gym xls')[0]?.id, 'total-gym');
  assert.deepEqual(findMachines('ab'), [], 'too short to search');
  const tg = names({ id: 'total-gym', machine: '', brand: '', gear: [], exercises: [] });
  assert.ok(tg.length >= 9 && tg.every((n) => n.startsWith('Total Gym')));
  const centr = names({ id: 'home-functional-trainer', machine: '', brand: 'Centr', gear: [], exercises: [] });
  assert.equal(centr[0], 'Standing Cable Chest Press');
  assert.ok(centr.length > 50, 'every cable move is listed');
});
