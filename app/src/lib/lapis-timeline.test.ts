import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseLapisTimer } from '../features/lapis/library';
import { compileLapisTimeline, phaseAt } from '../features/lapis/timeline';

test('linked timer expands prepare, work, rest, cycle recovery, cooldown', () => {
  const t = parseLapisTimer({
    v: 1, id: 'trx', name: 'TRX', prepare: 3, warmup: 0,
    work: 60, rest: 120, rounds: 2, cycles: 2,
    restBetweenCycles: 45, cooldown: 10,
    slots: [{ exercise: 'TRX row' }, { exercise: 'TRX squat', work: 30 }],
  })!;
  const timeline = compileLapisTimeline(t);
  assert.deepEqual(timeline.phases.map(p => [p.kind, p.name, p.seconds]), [
    ['prepare', 'Prepare', 3],
    ['work', 'TRX row', 60], ['rest', 'Rest', 120], ['work', 'TRX squat', 30],
    ['cycleRest', 'Rest between cycles', 45],
    ['work', 'TRX row', 60], ['rest', 'Rest', 120], ['work', 'TRX squat', 30],
    ['cooldown', 'Cooldown', 10],
  ]);
  assert.equal(timeline.totalSeconds, 478);
  assert.equal(phaseAt(timeline, 3).phase?.name, 'TRX row');
  assert.equal(phaseAt(timeline, 62).left, 1);
  assert.equal(phaseAt(timeline, 478).finished, true);
});
test('zero-length phases omitted and time never becomes negative', () => {
  const t = parseLapisTimer({
    v: 1, id: 'quick', name: 'Quick', prepare: 0, work: 15,
    rest: 0, rounds: 1, cycles: 1,
  })!;
  const timeline = compileLapisTimeline(t);
  assert.equal(timeline.phases.length, 1);
  assert.equal(phaseAt(timeline, -100).left, 15);
  assert.equal(phaseAt(timeline, Number.NaN).left, 15);
});
