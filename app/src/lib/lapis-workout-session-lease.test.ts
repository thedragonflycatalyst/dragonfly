import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { claimWorkoutSession, releaseWorkoutSession, isWorkoutSessionOwner,
  canScheduleWorkoutNotification, currentWorkoutSessionId } from '../features/lapis/workout-session-lease';

test('only the focused workout may claim audio and notifications', () => {
  claimWorkoutSession('mount-one', 'user:w:one');
  assert.equal(isWorkoutSessionOwner('mount-one'), true);
  assert.equal(canScheduleWorkoutNotification('user:w:one'), true);
  assert.equal(canScheduleWorkoutNotification('user:w:two'), false);
  claimWorkoutSession('mount-two', 'user:w:two');
  assert.equal(isWorkoutSessionOwner('mount-one'), false);
  assert.equal(isWorkoutSessionOwner('mount-two'), true);
  assert.equal(canScheduleWorkoutNotification('user:w:one'), false);
  assert.equal(currentWorkoutSessionId(), 'user:w:two');
});
test('an unmounting stale workout cannot release a newer lease', () => {
  claimWorkoutSession('old', 'user:a:one');
  claimWorkoutSession('new', 'user:a:two');
  assert.equal(releaseWorkoutSession('old'), false);
  assert.equal(isWorkoutSessionOwner('new'), true);
  assert.equal(releaseWorkoutSession('new'), true);
  assert.equal(canScheduleWorkoutNotification('user:a:two'), false);
});
test('the same workout mounted twice is isolated by mount token', () => {
  claimWorkoutSession('first', 'user:w:repeat');
  claimWorkoutSession('second', 'user:w:repeat');
  assert.equal(isWorkoutSessionOwner('first'), false);
  assert.equal(releaseWorkoutSession('first'), false);
  assert.equal(isWorkoutSessionOwner('second'), true);
  releaseWorkoutSession('second');
});
