import assert from 'node:assert/strict';
import { test } from 'node:test';
import { builtIn } from '../lib/library';
import { PROGRAM_TEMPLATES, scheduleFor } from './program-templates';

test('eight program templates covering the planned focuses', () => {
  assert.deepEqual(PROGRAM_TEMPLATES.map((t) => t.focus).sort(), ['Active aging', 'Aquatics', 'Fat loss', 'Hypertrophy', 'Pilates', 'Strength', 'TRX', 'Yoga']);
});

test('every exercise exists in the library', () => {
  const refs = new Set(builtIn().map((e) => e.ref));
  const missing: string[] = [];
  for (const t of PROGRAM_TEMPLATES) for (const w of t.workouts) for (const b of w.blocks) {
    if (b.kind === 'exercise' && !refs.has(`lib:${b.ex.id}`)) missing.push(`${t.key}/${w.name}: ${b.ex.id}`);
  }
  assert.deepEqual(missing, []);
});

test('schedules use every workout, stay inside the program, and match sessions per week', () => {
  for (const t of PROGRAM_TEMPLATES) {
    const ids = t.workouts.map((_, i) => `w${i}`);
    const s = scheduleFor(t, ids);
    const workouts = s.filter((d) => d.kind === 'workout');
    assert.equal(workouts.length, t.weeks * t.perWeek, t.key);
    assert.ok(s.every((d) => d.week >= 1 && d.week <= t.weeks && d.day >= 1 && d.day <= 7), t.key);
    assert.deepEqual([...new Set(workouts.map((d) => d.workout_id))].sort(), ids, t.key);
    assert.equal(s.filter((d) => d.kind === 'note').length, t.deloadWeeks?.length ?? 0, t.key);
  }
});
