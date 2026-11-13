import assert from 'node:assert/strict';
import { nextOccurrence, reminderDue, workoutReminderText } from './workout-reminders.ts';

const H = 3_600_000;
const wed3 = new Date('2026-11-18T20:00:00Z');   // Wed Nov 18, 3:00 PM New York

Deno.test('next workout time: one-time and weekly', () => {
  assert.equal(nextOccurrence(wed3, false, new Date(wed3.getTime() - H))?.getTime(), wed3.getTime());
  assert.equal(nextOccurrence(wed3, false, new Date(wed3.getTime() + H)), null);
  assert.equal(nextOccurrence(wed3, true, new Date(wed3.getTime() + H))?.toISOString(), '2026-11-25T20:00:00.000Z');
  assert.equal(nextOccurrence(wed3, true, new Date(wed3.getTime() + 15 * 24 * H))?.toISOString(), '2026-12-09T20:00:00.000Z');
});

Deno.test('the reminder goes the day before, once per workout time', () => {
  assert.equal(reminderDue(wed3, null, new Date(wed3.getTime() - 25 * H)), false);
  assert.equal(reminderDue(wed3, null, new Date(wed3.getTime() - 24 * H)), true);
  assert.equal(reminderDue(wed3, wed3, new Date(wed3.getTime() - 20 * H)), false);
  assert.equal(reminderDue(wed3, new Date(wed3.getTime() - 7 * 24 * H), new Date(wed3.getTime() - 20 * H)), true);
  assert.equal(reminderDue(wed3, null, new Date(wed3.getTime() + 1)), false);
});

Deno.test('reminder wording links straight to the routine', () => {
  const t = workoutReminderText('Ana', 'The Dragonfly Catalyst', 'Legs', 'tomorrow, Wed, Nov 18 at 3:00 PM', 'https://x/start/r1');
  assert.equal(t, 'Hi Ana, a reminder from The Dragonfly Catalyst: your workout "Legs" is tomorrow, Wed, Nov 18 at 3:00 PM. Start it here when you\'re ready: https://x/start/r1');
  assert.ok(t.length < 320);
});
