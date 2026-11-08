import assert from 'node:assert/strict';
import { rescheduleAlertText, urgentMessage } from './push.ts';

const TZ = 'America/New_York';
Deno.test('reschedule alert reads like the owner asked: name, old time, new time', () => {
  const now = new Date('2026-11-10T13:00:00Z');   // 8 AM in New York
  assert.equal(rescheduleAlertText('Susan Forbes', new Date('2026-11-10T20:00:00Z'), new Date('2026-11-10T22:00:00Z'), TZ, now), 'Susan Forbes, 3:00 PM wants to reschedule to 5:00 PM.');
  assert.equal(rescheduleAlertText('Susan Forbes', new Date('2026-11-11T20:00:00Z'), new Date('2026-11-12T22:00:00Z'), TZ, now), 'Susan Forbes, Wed, Nov 11 3:00 PM wants to reschedule to Thu, Nov 12 5:00 PM.');
  const m = urgentMessage('tok', 'Reschedule request', 'x', 'https://x.example');
  assert.equal(m.message.android.priority, 'HIGH');
  assert.equal(m.message.android.notification.channel_id, 'approvals');
  assert.equal(urgentMessage('t', 'a', 'b', 'https://thedragonflycatalyst.github.io/dragonfly/reschedule/abc').message.data.path, '/reschedule/abc');
});
