import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { cancelPrompt, isLateCancel, logLine, sameDayOnly, upcomingStatus, type LogEntry } from './appointments';

const now = new Date('2026-11-12T15:00:00Z');
const h = (n: number) => new Date(now.getTime() + n * 3_600_000);

test('late cancellation: inside the notice period or exactly at it', () => {
  assert.equal(isLateCancel(h(25), now, 24), false);
  assert.equal(isLateCancel(h(24), now, 24), true);
  assert.equal(isLateCancel(h(23.9), now, 24), true);
  assert.equal(isLateCancel(h(13), now, 12), false);
});

test('moves within 24 hours stay on the same day (24 hours exactly included)', () => {
  assert.equal(sameDayOnly(h(24), now), true);
  assert.equal(sameDayOnly(h(24.01), now), false);
});

test('the cancel prompt says plainly whether it counts as a session', () => {
  const late = cancelPrompt(h(5), now, 24, 'Thursday 3:00 PM');
  assert.ok(late.late && late.body.includes('still counts as a session') && late.body.includes('24 hours'));
  const fine = cancelPrompt(h(48), now, 24, 'Saturday 3:00 PM');
  assert.ok(!fine.late && fine.body.includes("won't count"));
  assert.ok(cancelPrompt(h(0.5), now, 1, 'x').body.includes('less than 1 hour away'));
});

test('history lines and statuses', () => {
  const fmt = (d: Date) => d.toISOString().slice(11, 16);
  const e = (action: LogEntry['action'], via: LogEntry['via'] = 'app'): LogEntry => ({ id: '1', action, via, old_start: h(1).toISOString(), new_start: h(3).toISOString(), created_at: now.toISOString() });
  assert.equal(logLine(e('moved'), fmt), 'Moved from 16:00 to 18:00');
  assert.equal(logLine(e('moved', 'trainer'), fmt), 'Moved by your trainer from 16:00 to 18:00');
  assert.equal(logLine(e('late_cancelled', 'text'), fmt), 'Cancelled 16:00 by text (late, counts as a session)');
  assert.equal(logLine(e('booked'), fmt), 'Booked 18:00');
  assert.equal(upcomingStatus(h(3), [e('moved')]), 'Moved');
  assert.equal(upcomingStatus(h(4), [e('moved')]), 'Booked');
});
