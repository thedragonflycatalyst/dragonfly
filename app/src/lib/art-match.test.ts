import assert from 'node:assert/strict';
import { test } from 'node:test';
import { artFor } from './art-match';

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
