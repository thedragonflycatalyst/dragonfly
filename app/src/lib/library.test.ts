import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alternativesFor, builtIn, byRef, search, setLibraryExtras, similarTo, titleCase, youTubeThumb } from './library.ts';
import { defaultMetric } from './workouts.ts';

test('library loads every Coach exercise once, with full details', () => {
  const all = builtIn();
  assert.ok(all.length >= 1700, `only ${all.length}`);
  assert.equal(new Set(all.map((e) => e.ref)).size, all.length, 'refs are unique');
  for (const e of all) {
    assert.match(e.ref, /^lib:c-[a-z0-9-]{1,118}$/, e.name);
    assert.ok(e.how?.setup && e.how.move && e.how.cues, `${e.name}: how-to`);
    assert.ok(e.primary.length && e.gear?.length && e.category && e.kind && e.pattern, `${e.name}: details`);
  }
});

test('every alternate name finds its exercise, ranked first', () => {
  const all = builtIn();
  const owners = new Map<string, string>();
  for (const e of all) for (const a of e.aliases ?? []) {
    assert.ok(!owners.has(a.toLowerCase()) || owners.get(a.toLowerCase()) === e.ref, `"${a}" belongs to two exercises`);
    owners.set(a.toLowerCase(), e.ref);
  }
  let checked = 0;
  for (const [a, ref] of owners) {
    if (all.some((e) => e.name.toLowerCase() === a)) continue; // another exercise's exact name wins
    assert.equal(search(all, { q: a })[0]?.ref, ref, `searching "${a}"`);
    checked++;
  }
  assert.ok(checked > 5000, `checked ${checked}`);
  assert.equal(search(all, { q: 'standing fallout' })[0].name, 'TRX Standing Rollout');
  assert.equal(search(all, { q: 'trx fallout' })[0].name, 'TRX Standing Rollout');
  assert.equal(search(all, { q: 'bench press' })[0].name, 'Barbell Bench Press');
});

test('search filters by body part, equipment and category', () => {
  const all = builtIn();
  const chest = search(all, { part: 'chest', equipment: 'Dumbbell' });
  assert.ok(chest.length > 10 && chest.every((e) => e.primary.some((m) => /chest/i.test(m)) && e.gear?.includes('Dumbbell')));
  assert.ok(search(all, { part: 'legs', category: 'corrective' }).some((e) => e.name === 'Quad Set'));
  assert.ok(search(all, { equipment: 'suspension trainer (trx)' }).length > 100);
  assert.equal(search(all, { q: 'zzzz nothing' }).length, 0);
});

test('looking up exercises by reference', () => {
  assert.equal(byRef('lib:trx_row'), undefined, 'the earlier still-image library is gone');
  assert.equal(byRef('lib:c-push-up')?.name, 'Push-Up');
  assert.equal(byRef('lib:does-not-exist'), undefined);
  assert.equal(byRef('my:x', [{ ref: 'my:x', name: 'Mine' } as never])?.name, 'Mine');
});

test('starting metric follows the movement pattern', () => {
  const by = (n: string) => builtIn().find((e) => e.name === n)!;
  assert.equal(defaultMetric(by('Forearm Plank')), 'time');
  assert.equal(defaultMetric(by("Farmer's Walk")), 'distance');
  assert.equal(defaultMetric(by('Glute Bridge')), 'reps');
  assert.equal(defaultMetric(by('Push-Up')), 'reps');
});

test('names and video thumbnails', () => {
  assert.equal(titleCase('middle back'), 'Middle Back');
  assert.equal(titleCase('Feet and ankles'), 'Feet and ankles');
  assert.equal(youTubeThumb('https://youtu.be/dQw4w9WgXcQ'), 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(youTubeThumb('https://www.youtube.com/shorts/dQw4w9WgXcQ?x=1'), 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(youTubeThumb('https://example.com/video.mp4'), null);
});

test('alternatives: trainer picks first, then similar moves for the same muscle and pattern', () => {
  const bench = builtIn().find((e) => e.name === 'Barbell Bench Press')!;
  const alts = alternativesFor(bench);
  assert.equal(alts.length, 6);
  assert.ok(alts.every((e) => e.ref !== bench.ref && e.primary.includes('Chest') && e.pattern === 'Horizontal push'));
  const pick = builtIn().find((e) => e.name === 'Push-Up')!;
  const mine = { ...bench, ref: 'my:x', mine: true, alts: [pick.ref, 'lib:does-not-exist'] };
  const withPick = alternativesFor(mine);
  assert.equal(withPick[0].ref, pick.ref);
  assert.equal(new Set(withPick.map((e) => e.ref)).size, withPick.length);
  assert.deepEqual(alternativesFor({ ...bench, primary: [], alts: [] }), []);
});

test('approved additions and extra names join the library', () => {
  setLibraryExtras([['x-ez-bar-close-grip-bench-press', 'EZ-Bar Close-Grip Bench Press', ['EZ Close Bench'], 'Barbell', 'Strength', 'Horizontal push',
    ['Triceps', 'Chest'], [], ['EZ bar', 'Bench'], 'Setup.', 'Move.', 'Cues.', '', 'Community additions'], ['bad']],
  [{ ref: 'lib:c-push-up', alias: 'Floor Press-Up' }, { ref: 'lib:c-push-up', alias: 'push-up' }]);
  try {
    assert.equal(byRef('lib:x-ez-bar-close-grip-bench-press')?.name, 'EZ-Bar Close-Grip Bench Press');
    assert.equal(search(builtIn(), { q: 'floor press-up' })[0]?.name, 'Push-Up');
    assert.equal(byRef('lib:c-push-up')?.aliases?.filter((a) => a.toLowerCase() === 'push-up').length, 0, 'no duplicate of the name');
  } finally { setLibraryExtras([], []); }
  assert.equal(byRef('lib:x-ez-bar-close-grip-bench-press'), undefined);
});

test('a suggestion is compared with the most similar library moves', () => {
  const got = similarTo({ name: 'EZ Bar Close Grip Bench Press', gear: ['EZ bar'], main: ['Triceps'] }, builtIn()).map((e) => e.name);
  assert.ok(got.slice(0, 10).includes('Close-Grip Bench Press'), got.slice(0, 10).join(', '));
  assert.ok(got.length <= 40);
  assert.equal(similarTo({ name: 'zzz', gear: [], main: [] }, builtIn()).length, 0);
});
