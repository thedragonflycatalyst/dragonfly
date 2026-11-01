import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock, copyWeek, doneOnly, readDraft, restAfter, setDay, trimWeeks } from './session';
import type { WorkoutBlock } from './model';

test('program days: set, replace, clear, copy, trim', () => {
  let s = setDay([], 1, 3, 'a');
  s = setDay(s, 1, 1, 'b');
  assert.deepEqual(s.map((x) => x.day), [1, 3]);
  s = setDay(s, 1, 3, 'c');
  assert.equal(s.length, 2); assert.equal(s[1].workout_id, 'c');
  s = copyWeek(s, 1, 2);
  assert.deepEqual(s.map((x) => `${x.week}.${x.day}`), ['1.1', '1.3', '2.1', '2.3']);
  assert.equal(trimWeeks(s, 1).length, 2);
  assert.equal(setDay(s, 2, 1, null).length, 3);
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
