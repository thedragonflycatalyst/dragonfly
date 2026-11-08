import assert from 'node:assert/strict';
const assertEquals = (a: unknown, b: unknown) => assert.deepStrictEqual(a, b);
import { cancelReplyText, CONFIRM_REPLY, e164, rescheduleReplyText, healthWord, isQuiet, nextSendable, occurrences, parseReply, reminderText, wall, zoned, type BookingRow } from './messaging.ts';

const TZ = 'America/New_York';
const b = (over: Partial<BookingRow>): BookingRow => ({ id: 'b', starts_at: '2026-10-26T11:00:00Z', duration_min: 60, repeat: 'weekly', repeat_until: null, skipped: [], client_id: 'c', title: 'Session', kind: 'session', location: null, ...over });

Deno.test('zoned and wall agree, including across DST', () => {
  const summer = zoned(2026, 10, 26, 7, 0, TZ);
  assertEquals(summer.toISOString(), '2026-10-26T11:00:00.000Z');
  const winter = zoned(2026, 11, 2, 7, 0, TZ);
  assertEquals(winter.toISOString(), '2026-11-02T12:00:00.000Z');
  assertEquals(wall(winter, TZ).h, 7);
});

Deno.test('weekly sessions stay at 7:00 local after the clocks change, and skipped dates are left out', () => {
  const occ = occurrences(b({ skipped: ['2026-11-09'] }), new Date('2026-10-30T00:00:00Z'), new Date('2026-11-20T00:00:00Z'), TZ);
  assertEquals(occ.map((o) => o.day), ['2026-11-02', '2026-11-16']);
  assert.ok(occ.every((o) => wall(o.start, TZ).h === 7));
});

Deno.test('one-off, repeat_until and monthly', () => {
  assertEquals(occurrences(b({ repeat: 'none', starts_at: '2026-11-10T15:00:00Z' }), new Date('2026-11-09T00:00:00Z'), new Date('2026-11-11T00:00:00Z'), TZ).length, 1);
  assertEquals(occurrences(b({ repeat_until: '2026-11-01' }), new Date('2026-10-30T00:00:00Z'), new Date('2026-11-20T00:00:00Z'), TZ).length, 0);
  const m = occurrences(b({ repeat: 'monthly', starts_at: '2026-01-31T15:00:00Z' }), new Date('2026-01-01T00:00:00Z'), new Date('2026-06-01T00:00:00Z'), TZ);
  assertEquals(m.map((o) => o.day), ['2026-01-31', '2026-03-31', '2026-05-31']);
});

Deno.test('quiet hours wrap midnight and the next sendable time is the end of quiet hours', () => {
  assert.ok(isQuiet(new Date('2026-11-10T03:00:00Z'), TZ, '21:00', '08:00'));   // 22:00 local
  assert.ok(!isQuiet(new Date('2026-11-10T15:00:00Z'), TZ, '21:00', '08:00'));  // 10:00 local
  assertEquals(nextSendable(new Date('2026-11-10T03:00:00Z'), TZ, '21:00', '08:00').toISOString(), '2026-11-10T13:00:00.000Z');
  assertEquals(nextSendable(new Date('2026-11-10T11:00:00Z'), TZ, '21:00', '08:00').toISOString(), '2026-11-10T13:00:00.000Z');
  const ok = new Date('2026-11-10T15:00:00Z');
  assertEquals(nextSendable(ok, TZ, '21:00', '08:00'), ok);
});

Deno.test('reminder text: day words, reply help by text only, nothing about health', () => {
  const now = new Date('2026-11-09T15:00:00Z');
  const sms = reminderText({ first: 'Ana', trainer: 'Emmet', start: new Date('2026-11-10T12:00:00Z'), tz: TZ, now, sms: true });
  assertEquals(sms, 'Hi Ana, reminder: training with Emmet tomorrow at 7:00 AM. Reply CONFIRM, RESCHEDULE or CANCEL APPOINTMENT. Reply STOP to opt out.');
  assertEquals(healthWord(sms), null);
  assert.ok(reminderText({ first: 'Ana', trainer: 'Emmet', start: new Date('2026-11-09T22:00:00Z'), tz: TZ, now, sms: false }).includes('today at 5:00 PM'));
});

Deno.test('health words are caught', () => {
  assertEquals(healthWord('How is your knee injury?'), 'injury');
  assertEquals(healthWord('Great conditioning work today'), null);
});

Deno.test('reply parsing', () => {
  assertEquals(parseReply(' stop ').kind, 'stop');
  assertEquals(parseReply('C').kind, 'confirm');
  assertEquals(parseReply('yes!').kind, 'yes');
  assertEquals(parseReply('4'), { kind: 'rating', value: 4 });
  assertEquals(parseReply('5/5'), { kind: 'rating', value: 5 });
  assertEquals(parseReply('6').kind, 'other');
  assertEquals(parseReply('Running late, sorry').kind, 'other');
});

Deno.test('phone numbers', () => {
  assertEquals(e164('(410) 555-0123'), '+14105550123');
  assertEquals(e164('+44 20 7946 0958'), '+442079460958');
  assertEquals(e164('555-0123'), null);
});

Deno.test('text replies: whole words; CANCEL alone stays an opt-out, CANCEL SESSION cancels', () => {
  assertEquals(parseReply('Confirm').kind, 'confirm');
  assertEquals(parseReply('reschedule').kind, 'reschedule');
  assertEquals(parseReply('Cancel session').kind, 'cancel_session');
  assertEquals(parseReply('cancel my appointment.').kind, 'cancel_session');
  assertEquals(parseReply('CANCEL').kind, 'stop');
  const r = cancelReplyText({ status: 'cancelled', hours: 24, link: 'https://x.example/calendar', trainer: 'Emmet' });
  assert.ok(r.startsWith('That’s too bad, I hope everything is okay!') && r.includes('https://x.example/calendar'));
  const late = cancelReplyText({ status: 'late_cancelled', hours: 24, link: 'https://x.example/calendar', trainer: 'Emmet' });
  assert.ok(late.includes('24-hour cancellation policy') && late.includes('counts as a session') && late.length <= 320, late);
  assert.ok(rescheduleReplyText('https://x.example/c').includes('CANCEL APPOINTMENT'));
  assertEquals(CONFIRM_REPLY, 'Perfect! See you then 😁');
});
