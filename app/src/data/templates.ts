// Dragonfly starter workouts. Trainers copy one into their own workouts and adjust it.
import { builtIn } from '../lib/library';
import type { ExerciseBlock, SetSpec, WorkoutBlock } from '../lib/model';
import { refOf } from '../lib/workouts';

type Line = [id: string, sets: number, target: string | number, rest?: number, note?: string];
const block = ([id, sets, target, rest = 60, note]: Line, i: number, group?: string): ExerciseBlock => {
  const e = builtIn().find((x) => x.ref === `lib:${id}`);
  const ex = e ? refOf(e) : { src: 'lib' as const, id, name: id.replace(/_/g, ' ') };
  const timed = typeof target === 'number';
  const set: SetSpec = timed ? { time: target as number, rest } : { reps: String(target), rest, weight: '' };
  return { id: `t${i}`, kind: 'exercise', ex, metric: timed ? 'time' : 'reps', sets: Array.from({ length: sets }, () => ({ ...set })), note, group: group ?? null };
};
export type { Line };
export const make = (lines: (Line | Line[])[]): WorkoutBlock[] => {
  const out: WorkoutBlock[] = [];
  lines.forEach((l, i) => {
    if (Array.isArray(l[0])) (l as Line[]).forEach((x, j) => out.push(block(x, i * 10 + j, `g${i}`)));
    else out.push(block(l as Line, i * 10));
  });
  return out;
};

export type Template = { key: string; name: string; description: string; cover: string; blocks: WorkoutBlock[] };
let cache: Template[] | null = null;
function build(): Template[] {
  return [
    { key: 'full-a', name: 'Full Body A (beginner)', cover: 'preset:0', description: 'Three days a week, alternating with Full Body B. Start light and learn the movements.', blocks: make([
      ['c-goblet-squat', 3, '10', 90], ['c-dumbbell-bench-press', 3, '10', 90], ['c-bent-over-dumbbell-row', 3, '10', 90],
      ['c-glute-bridge', 3, '12', 60], ['c-forearm-plank', 3, 30, 30]]) },
    { key: 'full-b', name: 'Full Body B (beginner)', cover: 'preset:1', description: 'Pairs with Full Body A.', blocks: make([
      ['c-dumbbell-forward-lunge', 3, '8 each leg', 90], ['c-seated-dumbbell-shoulder-press', 3, '10', 90], ['c-lat-pulldown', 3, '10', 90],
      ['c-romanian-deadlift', 3, '10', 90], ['c-dead-bug', 3, '10 each side', 45]]) },
    { key: 'upper', name: 'Upper Body', cover: 'preset:2', description: 'Push and pull with two supersets to save time.', blocks: make([
      ['c-incline-dumbbell-bench-press', 4, '8-10', 90], ['c-seated-cable-row', 4, '8-10', 90],
      [['c-seated-dumbbell-shoulder-press', 3, '10', 30], ['c-cable-face-pull', 3, '12-15', 75]],
      [['c-dumbbell-biceps-curl', 3, '12', 30], ['c-straight-bar-triceps-pushdown', 3, '12', 60]]]) },
    { key: 'lower', name: 'Lower Body', cover: 'preset:3', description: 'Squat, hinge and single-leg work.', blocks: make([
      ['c-barbell-high-bar-back-squat', 4, '6-8', 120], ['c-romanian-deadlift', 3, '8-10', 90], ['c-leg-press', 3, '12', 90],
      [['c-lying-leg-curl', 3, '12', 30], ['c-leg-extension', 3, '12', 60]], ['c-standing-calf-raise', 3, '15', 45]]) },
    { key: 'trx', name: 'Suspension Full Body', cover: 'preset:4', description: 'A full-body session on the suspension trainer. Step closer or farther from the anchor to scale.', blocks: make([
      ['c-trx-squat', 3, '15', 45], ['c-trx-mid-row', 3, '12', 45], ['c-trx-chest-press', 3, '12', 45], ['c-trx-lunge', 3, '10 each leg', 45],
      [['c-trx-y-fly', 3, '12', 15], ['c-trx-biceps-curl', 3, '12', 45]], ['c-trx-hamstring-curl', 3, '12', 45], ['c-trx-plank', 3, 30, 30]]) },
    { key: 'core', name: 'Core 15', cover: 'preset:5', description: 'A short core finisher.', blocks: make([
      ['c-forearm-plank', 3, 40, 20], ['c-side-plank', 3, 30, 20, 'Each side'], ['c-dead-bug', 3, '10 each side', 30], ['c-crunch', 3, '15', 30],
      ['c-mountain-climber', 3, 30, 30]]) },
    { key: 'conditioning', name: 'Bodyweight Conditioning', cover: 'preset:6', description: 'No equipment. Move quickly between exercises in each pair.', blocks: make([
      [['c-bodyweight-squat', 4, 40, 0], ['c-push-up', 4, 40, 40]], [['c-mountain-climber', 4, 30, 0], ['c-glute-bridge', 4, 40, 40]],
      ['c-air-bike', 3, 30, 30]]) },
  ];
}
export const TEMPLATES: Template[] = new Proxy([] as Template[], { get: (_t, k) => Reflect.get((cache ??= build()), k), has: (_t, k) => Reflect.has((cache ??= build()), k) });
