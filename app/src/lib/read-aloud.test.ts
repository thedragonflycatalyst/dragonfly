import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { clips, CLIP_MAX, spokenText } from './read-aloud';

test('reads the name and the how-to only', () => {
  const t = spokenText({ name: 'Low Row', how: { setup: 'Straps start at mid length', move: 'Pull your hands to your ribs in one second.', cues: 'Glutes tight' } });
  assert.equal(t, 'Low Row. Straps start at mid length. Pull your hands to your ribs in one second. Glutes tight.');
});

test("a trainer's own steps drop list numbering; nothing to read gives ''", () => {
  assert.equal(spokenText({ name: 'Plank:', steps: ['1. Elbows under shoulders', '- Squeeze glutes!'] }), 'Plank: Elbows under shoulders. Squeeze glutes!');
  assert.equal(spokenText({ name: 'Mystery', steps: [] }), '');
});

test('clips stay under the limit and keep every word in order', () => {
  const long = Array.from({ length: 12 }, (_, i) => `Sentence number ${i} keeps a neutral grip, a straight spine, hips popped forward and glutes clenched`).join('. ') + '.';
  const out = clips(long);
  assert.ok(out.length > 1);
  for (const c of out) assert.ok(c.length <= CLIP_MAX, c);
  assert.equal(out.join(' '), long);
  assert.deepEqual(clips('Short one.'), ['Short one.']);
  const run = 'word '.repeat(100).trim().replace(/ /g, ',').replace(/,/g, ' ');
  for (const c of clips(run)) assert.ok(c.length <= CLIP_MAX);
});
