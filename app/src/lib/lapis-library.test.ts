import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { lapisTimerSeconds, parseLapisTimer, timersFromSyncDoc } from '../features/lapis/library';

const sample = {
  v: 1, id: 'interval-1', name: 'TRX intervals',
  prepare: 10, warmup: 30, work: 60, rest: 120,
  rounds: 3, cycles: 2, restBetweenCycles: 90, cooldown: 20,
  slots: [{ exercise: 'TRX row' }, { exercise: 'TRX squat', work: 45 }],
  voice: { countdown: 3 },
};
test('reads full Lapis template and preserves its original snapshot', () => {
  const timer = parseLapisTimer(sample)!;
  assert.equal(timer.name, sample.name);
  assert.deepEqual(timer.template, sample);
  // One cycle: 60+45+60 + 2*120 = 405; twice plus overhead = 960.
  assert.equal(lapisTimerSeconds(timer), 10 + 30 + (60+45+60+240)*2 + 90 + 20);
});
test('rejects corrupt timer entries rather than importing incomplete workouts', () => {
  assert.equal(parseLapisTimer({ name: 'No ID', rounds: 3, work: 60 }), null);
  assert.equal(parseLapisTimer({ ...sample, rounds: -1 }), null);
  assert.equal(parseLapisTimer({ ...sample, cycles: 'many' }), null);
});
test('reads v1 sync order and excludes deleted timers', () => {
  const doc = {
    v: 1,
    timers: {
      'interval-1': { at: '2026-11-03T10:00:00Z', data: sample },
      'removed': { at: '2026-11-03T10:00:00Z', data: { ...sample, id: 'removed' } },
      'last': { at: '2026-11-04T09:00:00Z', data: { ...sample, id: 'last', name: 'Last' } },
    },
    deleted: { 'timers:removed': '2026-11-04T10:00:00Z' },
    order: { timers: { at: '2026-11-04T09:00:00Z', ids: ['last','interval-1','removed'] } },
  };
  assert.deepEqual(timersFromSyncDoc(doc).map(x => x.id), ['last', 'interval-1']);
});
test('empty, malformed, and unrelated synced data are harmless', () => {
  assert.deepEqual(timersFromSyncDoc(null), []);
  assert.deepEqual(timersFromSyncDoc({ timers: { bad: { data: { id: 'wrong' } } } }), []);
});
