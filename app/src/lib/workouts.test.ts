import assert from 'node:assert/strict';
import { test } from 'node:test';
import { builtIn } from './library.ts';
import type { ExerciseBlock, WorkoutBlock } from './model.ts';
import { TEMPLATES } from '../data/templates.ts';
import { addSet, cloneBlocks, estimateMinutes, fmtSeconds, linkNext, move, newBlock, normalizeGroups, parseSeconds, removeSet, setsDone, setsTotal, startLog, supersetLabels, unlink, volume } from './workouts.ts';

const lib = (name: string) => builtIn().find((e) => e.name === name)!;

test('new blocks get sensible starting sets', () => {
  const squat = newBlock(lib('Barbell Squat'));
  assert.equal(squat.metric, 'reps');
  assert.equal(squat.sets.length, 3);
  assert.equal(squat.ex.id, 'Barbell_Squat');
  assert.equal(newBlock(lib('Plank')).metric, 'time');
  const more = addSet(squat);
  assert.equal(more.sets.length, 4);
  assert.notEqual(more.sets[3], more.sets[2], 'added set is a copy, not the same object');
  assert.equal(removeSet(more, 0).sets.length, 3);
});

test('supersets link neighbors, stay unbroken and label A, B…', () => {
  let blocks: WorkoutBlock[] = ['Barbell Squat', 'Pushups', 'Plank', 'Crunches', 'Dead Bug'].map((n) => newBlock(lib(n)));
  blocks = linkNext(blocks, 0);
  assert.deepEqual(supersetLabels(blocks), ['A', 'A', null, null, null]);
  blocks = linkNext(blocks, 1); // plank joins: the superset grows
  assert.deepEqual(supersetLabels(blocks), ['A', 'A', 'A', null, null]);
  blocks = linkNext(blocks, 3);
  assert.deepEqual(supersetLabels(blocks), ['A', 'A', 'A', 'B', 'B']);
  blocks = linkNext(blocks, 2); // joining two supersets merges them
  assert.deepEqual(supersetLabels(blocks), ['A', 'A', 'A', 'A', 'A']);
  blocks = unlink(blocks, 2); // taking out the middle splits it in two
  assert.deepEqual(supersetLabels(blocks), ['A', 'A', null, 'B', 'B']);
  blocks = unlink(blocks, 0); // a superset of one dissolves
  assert.deepEqual(supersetLabels(blocks), [null, null, null, 'A', 'A']);
  assert.deepEqual(linkNext(blocks, 4), blocks, 'the last exercise has nothing to join');
  blocks = move(blocks, 4, 0); // moving one away breaks the run
  assert.deepEqual(supersetLabels(normalizeGroups(blocks)), [null, null, null, null, null]);
});

test('moving, cloning and timing', () => {
  assert.deepEqual(move([1, 2, 3], 0, 2), [2, 3, 1]);
  assert.deepEqual(move([1, 2, 3], 0, -1), [1, 2, 3]);
  const blocks = [newBlock(lib('Pushups'))];
  const copy = cloneBlocks(blocks);
  assert.notEqual(copy[0].id, blocks[0].id);
  (copy[0] as ExerciseBlock).sets[0].reps = '99';
  assert.equal((blocks[0] as ExerciseBlock).sets[0].reps, '10', 'clones are deep');
  assert.equal(parseSeconds('1:30'), 90);
  assert.equal(parseSeconds('45s'), 45);
  assert.equal(parseSeconds('abc'), null);
  assert.equal(fmtSeconds(90), '1:30');
  assert.equal(estimateMinutes(blocks), 5); // 3 × (40 + 60) s
});

test('logs start from the plan and add up', () => {
  const b = newBlock(lib('Dumbbell Bench Press'));
  b.sets = [{ reps: '8-10', weight: '40 lb', rest: 90 }, { reps: '8', weight: '45', rest: 90 }];
  const log = startLog([b], 'lb');
  assert.deepEqual(log[0].sets[0], { weight: 40, reps: 8, time: null, distance: null, done: false });
  assert.equal(setsTotal(log), 2);
  log[0].sets[0].done = true; log[0].sets[1].done = true;
  assert.equal(setsDone(log), 2);
  assert.equal(volume(log), 40 * 8 + 45 * 8);
});

test('every starter template uses real library exercises', () => {
  const refs = new Set(builtIn().map((e) => e.ref));
  for (const t of TEMPLATES) for (const b of t.blocks) {
    if (b.kind === 'exercise') assert.ok(refs.has(`lib:${b.ex.id}`), `${t.name}: ${b.ex.id} not in library`);
  }
  assert.ok(TEMPLATES.length >= 6);
});
