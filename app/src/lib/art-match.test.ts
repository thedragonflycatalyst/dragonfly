import assert from 'node:assert/strict';
import { test } from 'node:test';
import { artCover, artFor, exerciseArt } from './art-match';

test('artFor picks a picture from the routine name', () => {
  assert.equal(artFor('Leg Day'), 'legs');
  assert.equal(artFor('Upper Push Pull'), 'chest');
  assert.equal(artFor('Glute Builder'), 'glutes');
  assert.equal(artFor('TRX Core Blast'), 'suspension');
  assert.equal(artFor('Kettlebell Basics'), 'kettlebell');
  assert.equal(artFor('Saturday Bootcamp'), 'hiit');
  assert.equal(artFor('Marathon training'), 'running');
  assert.equal(artFor('Full Body Strength A'), 'fullbody');
  assert.equal(artFor('Morning Mobility'), 'yoga');
  assert.equal(artFor('Arms & Abs'), 'arms');
  assert.equal(artFor('Something else'), null);
});

test('artCover: a picked photo wins, otherwise the name decides', () => {
  assert.equal(artCover('art:yoga', 'Leg day'), 'yoga');
  assert.equal(artCover(null, 'Leg day'), 'legs');
  assert.equal(artCover(null, 'Monday plan'), null);
  assert.equal(artCover(null, 'Monday plan', true), 'fullbody');
  assert.equal(artCover('preset:2', 'Leg day'), null);
  assert.equal(artCover('preset:2', 'Leg day', true), 'legs');
  assert.equal(artCover('media:x/y.jpg', 'Leg day', true), null);
  assert.equal(artCover('art:bogus', 'Swim', true), 'swimming');
});

test('groups match group photos first', () => {
  assert.equal(artCover(null, 'Sunday Run Club', true, true), 'runclub');
  assert.equal(artCover(null, '30-day challenge', true, true), 'trophy');
  assert.equal(artCover(null, 'Trail hikers', true, true), 'hike');
  assert.equal(artCover(null, 'Morning crew', true, true), 'team');
  assert.equal(artCover(null, 'Kettlebell gang', true, true), 'kettlebell');
  assert.equal(artCover(null, 'Our people', true, true), 'crew');
  assert.equal(artCover('art:dragonfly', 'Leg day', true), 'dragonfly');
});

test('upper body and hinges', () => {
  assert.equal(artFor('Upper Body'), 'back');
  assert.equal(artFor('Upper push'), 'chest');
  assert.equal(artFor('RDL day'), 'fullbody');
  assert.equal(artFor('Deadlift focus'), 'fullbody');
  assert.equal(artFor('Leg Day'), 'legs');
});

test('exercises without a demo get a placeholder that fits', () => {
  assert.equal(exerciseArt({ name: 'Leg Press', category: 'Machine', primary: ['Quads', 'Glutes'] }), 'legs');
  assert.equal(exerciseArt({ name: 'Hip Thrust', category: 'Barbell', primary: ['Glutes'] }), 'glutes');
  assert.equal(exerciseArt({ name: 'TRX Row', category: 'Suspension (TRX)', primary: ['Upper back'] }), 'suspension');
  assert.equal(exerciseArt({ name: 'Reformer Hundred', category: 'Pilates', primary: ['Abs'] }), 'yoga');
  assert.equal(exerciseArt({ name: 'Water Walking', category: 'Aquatics', primary: ['Full body'] }), 'swimming');
  assert.equal(exerciseArt({ name: 'Cable Curl', category: 'Cable', primary: ['Biceps'] }), 'arms');
  assert.equal(exerciseArt({ name: 'Mystery Move' }), 'fullbody');
});
