import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reminderAt, reminderLine } from './routines';

test('a reminder day and time become one moment on this device', () => {
  const at = reminderAt('2026-11-18', '15:00');
  assert.equal(at.getFullYear(), 2026); assert.equal(at.getMonth(), 10); assert.equal(at.getDate(), 18); assert.equal(at.getHours(), 15);
});

test('reminders read naturally', () => {
  const at = reminderAt('2026-11-18', '15:00').toISOString();
  assert.equal(reminderLine({ at, weekly: true }), 'Every Wednesday at 3:00 PM');
  assert.equal(reminderLine({ at, weekly: false }), 'Wed, Nov 18 at 3:00 PM');
});
