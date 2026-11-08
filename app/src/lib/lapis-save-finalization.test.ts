import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { canMutateWorkoutTimer } from '../features/lapis/save-finalization';

test('live workout callbacks can update only their own active session', () => {
  assert.equal(canMutateWorkoutTimer('a:one', 'a:one', false, false), true);
  assert.equal(canMutateWorkoutTimer('a:one', 'a:two', false, false), false);
});
test('save-in-flight, successful save and discard all suppress late timer events', () => {
  assert.equal(canMutateWorkoutTimer('w:one', 'w:one', true, false), false);
  assert.equal(canMutateWorkoutTimer('w:one', 'w:one', false, true), false);
  assert.equal(canMutateWorkoutTimer('w:one', 'w:one', true, true), false);
  assert.equal(canMutateWorkoutTimer('w:one', 'w:one', false, false), true);
});
