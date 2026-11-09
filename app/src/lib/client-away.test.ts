import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { awayLine, awayState, lastSessionLine, sectionOf } from './client-away';

const day = '2026-11-08';

test('away states', () => {
  assert.equal(awayState({}, day), null);
  assert.equal(awayState({ away_reason: 'injury', away_until: '2026-12-03' }, day), 'away');
  assert.equal(awayState({ away_reason: 'injury' }, day), 'away');
  assert.equal(awayState({ away_reason: 'travel', away_from: '2026-11-08', away_until: '2026-11-08' }, day), 'away');
  assert.equal(awayState({ away_reason: 'travel', away_from: '2026-11-20', away_until: '2026-12-01' }, day), 'upcoming');
  assert.equal(awayState({ away_reason: 'travel', away_until: '2026-11-07' }, day), 'back');
  assert.equal(awayState({ away_reason: 'travel', away_until: '2026-10-25' }, day), 'back');
  assert.equal(awayState({ away_reason: 'travel', away_until: '2026-10-24' }, day), null);
});

test('list sections', () => {
  assert.equal(sectionOf({ status: 'active' }, day), 'active');
  assert.equal(sectionOf({ status: 'invited' }, day), 'active');
  assert.equal(sectionOf({ status: 'active', away_reason: 'injury', away_until: '2026-12-03' }, day), 'away');
  assert.equal(sectionOf({ status: 'active', away_reason: 'travel', away_from: '2026-12-01' }, day), 'active');
  assert.equal(sectionOf({ status: 'frozen', away_reason: 'injury' }, day), 'inactive');
  assert.equal(sectionOf({ status: 'archived' }, day), 'archived');
  assert.equal(sectionOf({ status: 'lead' }, day), 'pool');
});

test('lines', () => {
  assert.equal(awayLine({ away_reason: 'injury', away_until: '2026-12-03' }, day), 'Injured until Dec 3');
  assert.equal(awayLine({ away_reason: 'travel' }, day), 'Traveling, no return date yet');
  assert.equal(awayLine({ away_reason: 'travel', away_from: '2026-12-10', away_until: '2027-01-04' }, day), 'Traveling from Dec 10 to Jan 4');
  assert.equal(awayLine({ away_reason: 'travel', away_until: '2026-11-03' }, day), 'Back from traveling since Nov 3');
  const now = new Date('2026-11-08T12:00:00Z');
  assert.equal(lastSessionLine('2026-10-30T12:00:00Z', now), 'Last session 9 days ago');
  assert.equal(lastSessionLine('2026-10-01T12:00:00Z', now), 'Last session 5 weeks ago');
  assert.equal(lastSessionLine(null, now), null);
});
