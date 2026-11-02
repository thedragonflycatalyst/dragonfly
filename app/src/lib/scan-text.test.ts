import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appointmentKey, timesIn } from './scan-text';

test('timesIn reads 12- and 24-hour times', () => {
  assert.deepEqual(timesIn('Duration: 03:00pm - 04:00pm'), ['15:00', '16:00']);
  assert.deepEqual(timesIn('Tue 9 AM with Sam, 12pm lunch, 12:30 a.m.'), ['09:00', '12:00', '00:30']);
  assert.deepEqual(timesIn('Leg day 18:45'), ['18:45']);
  assert.deepEqual(timesIn('$58.00 (3609574) 13 reps'), []);
});

test('appointmentKey needs a time and some words', () => {
  assert.equal(appointmentKey('Individual Elite Personal Training\nDuration: 03:00pm - 04:00pm\nClients: Gunjan'), '15:00,16:00');
  assert.equal(appointmentKey('3:00pm'), null);
  assert.equal(appointmentKey('Organizer Service Location'), null);
});
