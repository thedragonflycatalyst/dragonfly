import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { sameAudioGeneration } from '../features/lapis/audio-generation';

test('a bell-to-speech sequence cannot outlive a hush', () => {
  const bellStarted = 11;
  assert.equal(sameAudioGeneration(bellStarted, 11), true);
  assert.equal(sameAudioGeneration(bellStarted, 12), false);
});
test('a newer workout generation cannot be mistaken for the previous one', () => {
  assert.equal(sameAudioGeneration(3, 4), false);
  assert.equal(sameAudioGeneration(4, 4), true);
});
