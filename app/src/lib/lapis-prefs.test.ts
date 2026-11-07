import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { selectChangedPrefs } from '../features/lapis/prefs-patch';

const saved = {
  voice: { name: 'en-IE-ConnorNeural' },
  music: 'duck', voiceLevel: 1, voiceSpeed: 1, haptics: true, bell: 'ring2',
};
test('single edit updates just one shared key', () => {
  assert.deepEqual(selectChangedPrefs({ music: 'pause' }, { ...saved, music: 'pause' }), { music: 'pause' });
});
test('local-only and untrusted fields never enter a cloud patch', () => {
  assert.deepEqual(selectChangedPrefs({ defaultRest: 90, timers: { bad: true }, haptics: false },
    { ...saved, haptics: false }), { haptics: false });
});
test('voice edit uses Lapis serialized voice object', () => {
  assert.deepEqual(selectChangedPrefs({ voice: 'Ava' }, { ...saved, voice: { name: 'en-US-AvaNeural' } }),
    { voice: { name: 'en-US-AvaNeural' } });
});
test('no shared edits leaves cloud document untouched', () => {
  assert.deepEqual(selectChangedPrefs({ keepAwake: false }, saved), {});
});
