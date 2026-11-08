import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  canStartLinkedTimer, canStartTimedSet, canResumeRest,
} from '../features/lapis/timer-ownership';

test('idle workout allows any timer and rest resume', () => {
  const idle = { linked: null, timedSet: null };
  assert.equal(canStartLinkedTimer(idle, 'interval-a'), true);
  assert.equal(canStartTimedSet(idle, 'exercise-1'), true);
  assert.equal(canResumeRest(idle), true);
});
test('linked workout timer exclusively owns cues', () => {
  const owner = { linked: 'interval-a', timedSet: null };
  assert.equal(canStartLinkedTimer(owner, 'interval-a'), true);
  assert.equal(canStartLinkedTimer(owner, 'interval-b'), false);
  assert.equal(canStartTimedSet(owner, 'exercise-1'), false);
  assert.equal(canResumeRest(owner), false);
});
test('timed exercise set blocks linked timers and competing sets', () => {
  const owner = { linked: null, timedSet: 'exercise-1' };
  assert.equal(canStartLinkedTimer(owner, 'interval-a'), false);
  assert.equal(canStartTimedSet(owner, 'exercise-1'), true);
  assert.equal(canStartTimedSet(owner, 'exercise-2'), false);
  assert.equal(canResumeRest(owner), false);
});
