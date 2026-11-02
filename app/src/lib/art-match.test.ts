import assert from 'node:assert/strict';
import { test } from 'node:test';
import { artCover, artFor } from './art-match';

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
