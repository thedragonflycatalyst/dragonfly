import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { activeLinkedTimer, matchesPendingAssignment } from '../features/lapis/integration-guards';

test('only the latest active linked timer owns audio when restoring a draft', () => {
  const clocks = {
    row: { since: 1000 },
    squat: { since: 2000 },
    old: { since: 9000 },
    paused: { since: null },
  };
  assert.equal(activeLinkedTimer(clocks, ['row', 'squat', 'paused']), 'squat');
  assert.equal(activeLinkedTimer(clocks, ['paused']), null);
  assert.equal(activeLinkedTimer({}, ['row']), null);
});
test('confirmed assignment must match the exact identity saved before request', () => {
  const row = { id: 'stable-id', trainer_id: 'trainer', client_id: 'client',
    workout_id: 'workout' };
  assert.equal(matchesPendingAssignment(row, 'stable-id', 'trainer', 'client', 'workout'), true);
  assert.equal(matchesPendingAssignment(row, 'stable-id', 'trainer', 'other', 'workout'), false);
  assert.equal(matchesPendingAssignment(row, 'stable-id', 'trainer', 'client', null), false);
  assert.equal(matchesPendingAssignment(null, 'stable-id', 'trainer', 'client', 'workout'), false);
});
