import assert from 'node:assert/strict';
import { test } from 'node:test';
import { builtIn, byRef, search, youTubeThumb } from './library.ts';

test('library loads every exercise once, with images', () => {
  const all = builtIn();
  assert.ok(all.length > 890, `only ${all.length}`);
  assert.equal(new Set(all.map((e) => e.ref)).size, all.length, 'refs are unique');
  const plank = all.find((e) => e.name === 'Plank');
  assert.ok(plank && plank.images.length === 2 && plank.images[0].startsWith('https://cdn.jsdelivr.net/'));
  assert.ok(all.some((e) => e.equipment === 'suspension trainer'), 'suspension set included');
});

test('search ranks name matches first and supports filters', () => {
  const all = builtIn();
  const r = search(all, { q: 'plank' });
  assert.equal(r[0].name, 'Plank');
  assert.ok(r.length > 3);
  assert.ok(search(all, { q: 'suspension row' }).some((e) => e.ref === 'lib:trx_row'));
  const chest = search(all, { part: 'chest', equipment: 'dumbbell' });
  assert.ok(chest.length > 5 && chest.every((e) => e.primary.includes('chest') && e.equipment === 'dumbbell'));
  assert.equal(search(all, { q: 'zzzz nothing' }).length, 0);
});

test('lookups and video thumbnails', () => {
  assert.equal(byRef('lib:trx_row')?.name, 'Suspension Row');
  assert.equal(byRef('my:x', [{ ref: 'my:x', name: 'Mine' } as never])?.name, 'Mine');
  assert.equal(youTubeThumb('https://youtu.be/dQw4w9WgXcQ'), 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(youTubeThumb('https://www.youtube.com/shorts/dQw4w9WgXcQ?x=1'), 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(youTubeThumb('https://example.com/video.mp4'), null);
});

test('alternatives: trainer picks first, then similar moves for the same muscle', async () => {
  const { alternativesFor, builtIn } = await import('./library');
  const bench = builtIn().find((e) => /^Barbell Bench Press/i.test(e.name))!;
  const alts = alternativesFor(bench);
  assert.ok(alts.length > 0 && alts.length <= 6);
  assert.ok(alts.every((e) => e.ref !== bench.ref && e.primary.includes('chest')));
  const pick = builtIn().find((e) => e.name === 'Pushups')!;
  const mine = { ...bench, ref: 'my:x', mine: true, alts: [pick.ref, 'lib:does-not-exist'] };
  const withPick = alternativesFor(mine);
  assert.equal(withPick[0].ref, pick.ref);
  assert.equal(new Set(withPick.map((e) => e.ref)).size, withPick.length);
  assert.deepEqual(alternativesFor({ ...bench, primary: [], alts: [] }), []);
});
