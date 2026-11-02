import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addItem, clock, compliance, copyWeek, deleteWeek, doneOnly, itemsOn, kindOf, moveItem, readDraft, removeItem, restAfter, trimWeeks } from './session';
import type { WorkoutBlock } from './model';

test('program items: several per day, ordered, copy and delete weeks', () => {
  let s = addItem([], { week: 1, day: 3, workout_id: 'a' });
  s = addItem(s, { week: 1, day: 1, kind: 'measurements' });
  s = addItem(s, { week: 1, day: 1, kind: 'photo' });
  assert.deepEqual(s.map((x) => `${x.day}${kindOf(x)[0]}`), ['1m', '1p', '3w']);
  assert.equal(itemsOn(s, 1, 1).length, 2);
  assert.equal(itemsOn(s, 1, 1)[1].index, 1);
  s = moveItem(s, 2, 2, 5);
  assert.deepEqual(s.map((x) => `${x.week}.${x.day}`), ['1.1', '1.1', '2.5']);
  s = copyWeek(s, 1, 3);
  assert.equal(itemsOn(s, 3, 1).length, 2);
  s = deleteWeek(s, 2);
  assert.deepEqual(s.map((x) => x.week), [1, 1, 2, 2]);
  assert.equal(trimWeeks(s, 1).length, 2);
  assert.equal(removeItem(s, 0).length, 3);
  assert.equal(compliance(3, 4), 75); assert.equal(compliance(0, 0), null);
});

test('rest, clock, done sets, drafts', () => {
  const blocks: WorkoutBlock[] = [{ id: 'x', kind: 'exercise', ex: { src: 'lib', id: 'a', name: 'A' }, metric: 'reps', sets: [{ rest: 90 }, {}] }];
  assert.equal(restAfter(blocks, 'x', 0), 90);
  assert.equal(restAfter(blocks, 'x', 1), 60);
  assert.equal(restAfter(blocks, 'nope', 0), 60);
  assert.equal(clock(65), '1:05'); assert.equal(clock(3725), '1:02:05');
  assert.deepEqual(doneOnly([{ block_id: 'x', sets: [{ done: true, reps: 5 }, { done: false }] }, { block_id: 'y', sets: [{ done: false }] }]),
    [{ block_id: 'x', sets: [{ done: true, reps: 5 }] }]);
  assert.equal(readDraft(() => '{bad'), null);
  assert.equal(readDraft(() => '{"key":"a","log":[]}')?.key, 'a');
});
