import assert from 'node:assert/strict';
import { healthWord } from '../_shared/messaging.ts';
import { approvedText, declinedText, trainerAlertText, trainerMovedText } from './reschedule.ts';

Deno.test('reschedule texts are short, clear and in the trainer\'s voice', () => {
  const a = trainerAlertText('Susan Forbes, 3:00 PM wants to reschedule to 5:00 PM.', 'https://x.example/calendar?requests=1');
  assert.ok(a.startsWith('RESCHEDULE REQUEST') && a.includes('Approve or decline'));
  assert.equal(approvedText('tomorrow at 9:00 AM'), "You're all set! Your session is now tomorrow at 9:00 AM. See you then 😁");
  const d = declinedText('tomorrow at 9:00 AM', 'tomorrow at 7:00 AM', 'fully booked');
  assert.ok(d.includes('stays tomorrow at 7:00 AM') && d.includes('(fully booked)'));
  const mv = trainerMovedText('Susan Forbes, 3:00 PM moved to 5:00 PM.', 'https://x.example/calendar');
  assert.ok(mv.startsWith('SESSION MOVED') && !mv.includes('Approve'));
  for (const m of [a, d, mv]) { assert.ok(m.length <= 320); assert.equal(healthWord(m), null); }
});
