import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseLapisTimer } from '../features/lapis/library';
import { compileLapisTimeline } from '../features/lapis/timeline';
import { compileSpokenCues, cuesCrossed } from '../features/lapis/cue-plan';

test('custom cues retain per-round timing, countdown and halfway override', () => {
  const timer = parseLapisTimer({
    v: 1, id: 'trx', name: 'TRX', prepare: 0, warmup: 0,
    work: 60, rest: 10, rounds: 2, cycles: 1,
    voice: { countdown: 3, halfwayText: 'Halfway' },
    slots: [
      { exercise: 'Row', cues: [
        { when: 'start', text: 'Go row!' },
        { when: 'halfway', text: 'Switch arms!' },
        { when: 'secondsLeft', text: '10 left', seconds: 10 },
        { when: 'every', text: 'Breathe', seconds: 20 },
        { when: 'end', text: 'Done row!' },
      ] },
      { exercise: 'Squat', work: 30, cues: [] },
    ],
  })!;
  const plan = compileSpokenCues(timer, compileLapisTimeline(timer));
  assert.ok(plan.some((x) => x.text === 'Switch arms!' && x.at === 30));
  assert.ok(!plan.some((x) => x.text === 'Halfway' && x.at === 30));
  assert.ok(plan.some((x) => x.text === 'Halfway' && x.at === 85));
  assert.ok(plan.some((x) => x.text === '10 left' && x.at === 50));
  assert.ok(plan.some((x) => x.text === '3' && x.at === 57));
  assert.ok(plan.some((x) => x.text === 'Done row!' && x.at === 60));
});
test('cue lookups do not replay events after long background suspension', () => {
  const cues = [{ at: 20, key: '20', text: 'Halfway', kind: 'speech' as const }];
  assert.deepEqual(cuesCrossed(cues, 19.8, 20.2).map((x) => x.key), ['20']);
  assert.deepEqual(cuesCrossed(cues, 10, 40), []);
  assert.deepEqual(cuesCrossed(cues, 21, 20), []);
});
