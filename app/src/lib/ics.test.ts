import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIcs, busyFromIcs, calendarUrl, zonedToUtc } from '../../../supabase/functions/_shared/ics';

test('zonedToUtc handles daylight saving', () => {
  assert.equal(zonedToUtc(2026, 1, 15, 9, 0, 0, 'America/New_York').toISOString(), '2026-01-15T14:00:00.000Z');
  assert.equal(zonedToUtc(2026, 7, 15, 9, 0, 0, 'America/New_York').toISOString(), '2026-07-15T13:00:00.000Z');
});

const feed = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT', 'UID:a', 'DTSTART:20261103T150000Z', 'DTEND:20261103T160000Z', 'SUMMARY:Dentist\\, downtown', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:b', 'DTSTART;TZID=America/New_York:20261026T090000', 'DTEND;TZID=America/New_York:20261026T093000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6', 'EXDATE;TZID=America/New_York:20261104T090000', 'SUMMARY:Standup', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:b', 'RECURRENCE-ID;TZID=America/New_York:20261109T090000', 'DTSTART;TZID=America/New_York:20261109T110000',
  'DTEND;TZID=America/New_York:20261109T113000', 'SUMMARY:Standup (moved)', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:c', 'DTSTART;VALUE=DATE:20261105', 'SUMMARY:Holiday', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:d', 'DTSTART:20261106T150000Z', 'DTEND:20261106T160000Z', 'TRANSP:TRANSPARENT', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

test('busyFromIcs expands repeats, skips exceptions, all-day and free events', () => {
  const b = busyFromIcs(feed, new Date('2026-11-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z'), 'America/New_York');
  assert.deepEqual(b.map((x) => [x.starts_at, x.title]), [
    ['2026-11-02T14:00:00.000Z', 'Standup'],          // 9am EST after DST ended
    ['2026-11-03T15:00:00.000Z', 'Dentist, downtown'],
    ['2026-11-09T16:00:00.000Z', 'Standup (moved)'],  // 11/4 excluded; 11/9 replaced by its override
    ['2026-11-11T14:00:00.000Z', 'Standup'],          // 6th occurrence (count includes 10/26, 10/28)
  ]);
  assert.equal(b[0].ends_at, '2026-11-02T14:30:00.000Z');
});

test('buildIcs writes repeats in the trainer zone', () => {
  const s = buildIcs('Dragonfly', 'Europe/London', [{ uid: 'x', title: 'Session, Sam', start: new Date('2026-11-02T09:00:00Z'), minutes: 60, repeat: 'weekly', skipped: ['2026-11-09'] }]);
  assert.match(s, /DTSTART;TZID=Europe\/London:20261102T090000/);
  assert.match(s, /RRULE:FREQ=WEEKLY\r\n/);
  assert.match(s, /EXDATE;TZID=Europe\/London:20261109T090000/);
  assert.match(s, /SUMMARY:Session\\, Sam/);
  const back = busyFromIcs(s, new Date('2026-11-01T00:00:00Z'), new Date('2026-11-24T00:00:00Z'), 'Europe/London');
  assert.deepEqual(back.map((x) => x.starts_at.slice(0, 10)), ['2026-11-02', '2026-11-16', '2026-11-23']);
});

test('calendarUrl only allows calendar services over https', () => {
  assert.equal(calendarUrl('webcal://p12-caldav.icloud.com/published/2/abc'), 'https://p12-caldav.icloud.com/published/2/abc');
  assert.ok(calendarUrl('https://calendar.google.com/calendar/ical/x%40gmail.com/private-abc/basic.ics'));
  assert.equal(calendarUrl('https://169.254.169.254/latest'), null);
  assert.equal(calendarUrl('http://calendar.google.com/x'), null);
  assert.equal(calendarUrl('https://calendar.google.com.evil.com/x'), null);
  assert.equal(calendarUrl('https://calendar.google.com:8443/x'), null);
});
