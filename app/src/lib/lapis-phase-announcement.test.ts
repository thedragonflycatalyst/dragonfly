import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { announcementForPhase } from '../features/lapis/phase-announcement';
import type { LapisPhase } from '../features/lapis/timeline';

const work: LapisPhase = { kind: 'work', name: 'TRX row', seconds: 60,
  startAt: 3, endAt: 63, round: 1, cycle: 1 };
const timer = {
  rounds: 4,
  slots: [{ exercise: 'TRX row' }, { exercise: 'TRX squat' }],
  voice: {},
};
test('default work sound is bell, with round and exercise announced', () => {
  assert.deepEqual(announcementForPhase(work, timer),
    { ring: true, speech: 'Round 1 of 4. TRX row' });
});
test('voice-only and silent start modes respect voice options', () => {
  assert.deepEqual(announcementForPhase(work, {
    ...timer, voice: { startSound: 'voice', announceRounds: false, announceExercise: false },
  }), { ring: false, speech: 'Start' });
  assert.deepEqual(announcementForPhase(work, {
    ...timer, voice: { startSound: 'none', announceRounds: false, announceExercise: false },
  }), { ring: false, speech: null });
});
test('rest announcement can identify next Lapis round exercise', () => {
  const rest: LapisPhase = { kind: 'rest', name: 'Rest', seconds: 30,
    startAt: 63, endAt: 93, round: 1, cycle: 1 };
  assert.deepEqual(announcementForPhase(rest, timer),
    { ring: false, speech: 'Rest. Next up: TRX squat' });
  assert.deepEqual(announcementForPhase(rest, {
    ...timer, voice: { announceNext: false },
  }), { ring: false, speech: 'Rest' });
});
