import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { completedNaturally, phaseTransitionDue } from '../features/lapis/runner-events';
import type { LapisTimeline } from '../features/lapis/timeline';
const timeline: LapisTimeline = {
  totalSeconds: 130,
  phases: [
    { kind: 'work', name: 'Row', seconds: 60, startAt: 0, endAt: 60 },
    { kind: 'rest', name: 'Rest', seconds: 10, startAt: 60, endAt: 70 },
    { kind: 'work', name: 'Squat', seconds: 60, startAt: 70, endAt: 130 },
  ],
};
test('a fresh start announces the first phase once', () => {
  assert.equal(phaseTransitionDue(timeline, null, 0, 0, true, true), true);
  assert.equal(phaseTransitionDue(timeline, 0, 0, 0.2, true, false), false);
});
test('restored mid-interval and late foreground wake cannot replay a phase cue', () => {
  assert.equal(phaseTransitionDue(timeline, null, 0, 38, true, false), false);
  assert.equal(phaseTransitionDue(timeline, 0, 2, 102, true, false), false);
  assert.equal(phaseTransitionDue(timeline, 0, 1, 60.2, false, false), false);
});
test('fresh observed phase transitions can be announced', () => {
  assert.equal(phaseTransitionDue(timeline, 0, 1, 60.2, true, false), true);
  assert.equal(phaseTransitionDue(timeline, 1, 2, 70.3, true, false), true);
});
test('only complete non-skipped runs are logged', () => {
  assert.equal(completedNaturally(true, false, 130, 130), true);
  assert.equal(completedNaturally(true, true, 130, 130), false);
  assert.equal(completedNaturally(false, false, 130, 130), false);
  assert.equal(completedNaturally(true, false, 129.9, 130), false);
  assert.equal(completedNaturally(true, false, 0, 0), false);
});
