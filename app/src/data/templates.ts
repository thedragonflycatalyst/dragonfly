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
const make = (lines: (Line | Line[])[]): WorkoutBlock[] => {
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
      ['Goblet_Squat', 3, '10', 90], ['Dumbbell_Bench_Press', 3, '10', 90], ['Bent_Over_Two-Dumbbell_Row', 3, '10', 90],
      ['Butt_Lift_Bridge', 3, '12', 60], ['Plank', 3, 30, 30]]) },
    { key: 'full-b', name: 'Full Body B (beginner)', cover: 'preset:1', description: 'Pairs with Full Body A.', blocks: make([
      ['Dumbbell_Lunges', 3, '8 each leg', 90], ['Dumbbell_Shoulder_Press', 3, '10', 90], ['Wide-Grip_Lat_Pulldown', 3, '10', 90],
      ['Romanian_Deadlift', 3, '10', 90], ['Dead_Bug', 3, '10 each side', 45]]) },
    { key: 'upper', name: 'Upper Body', cover: 'preset:2', description: 'Push and pull with two supersets to save time.', blocks: make([
      ['Incline_Dumbbell_Press', 4, '8-10', 90], ['Seated_Cable_Rows', 4, '8-10', 90],
      [['Dumbbell_Shoulder_Press', 3, '10', 30], ['Face_Pull', 3, '12-15', 75]],
      [['Dumbbell_Bicep_Curl', 3, '12', 30], ['Triceps_Pushdown', 3, '12', 60]]]) },
    { key: 'lower', name: 'Lower Body', cover: 'preset:3', description: 'Squat, hinge and single-leg work.', blocks: make([
      ['Barbell_Squat', 4, '6-8', 120], ['Romanian_Deadlift', 3, '8-10', 90], ['Leg_Press', 3, '12', 90],
      [['Lying_Leg_Curls', 3, '12', 30], ['Leg_Extensions', 3, '12', 60]], ['Standing_Calf_Raises', 3, '15', 45]]) },
    { key: 'trx', name: 'Suspension Full Body', cover: 'preset:4', description: 'A full-body session on the suspension trainer. Step closer or farther from the anchor to scale.', blocks: make([
      ['trx_squat', 3, '15', 45], ['trx_row', 3, '12', 45], ['trx_chest_press', 3, '12', 45], ['trx_lunge', 3, '10 each leg', 45],
      [['trx_y_fly', 3, '12', 15], ['trx_biceps_curl', 3, '12', 45]], ['trx_hamstring_curl', 3, '12', 45], ['trx_plank', 3, 30, 30]]) },
    { key: 'core', name: 'Core 15', cover: 'preset:5', description: 'A short core finisher.', blocks: make([
      ['Plank', 3, 40, 20], ['Side_Bridge', 3, 30, 20, 'Each side'], ['Dead_Bug', 3, '10 each side', 30], ['Crunches', 3, '15', 30],
      ['Mountain_Climbers', 3, 30, 30]]) },
    { key: 'conditioning', name: 'Bodyweight Conditioning', cover: 'preset:6', description: 'No equipment. Move quickly between exercises in each pair.', blocks: make([
      [['Bodyweight_Squat', 4, 40, 0], ['Pushups', 4, 40, 40]], [['Mountain_Climbers', 4, 30, 0], ['Butt_Lift_Bridge', 4, 40, 40]],
      ['Air_Bike', 3, 30, 30]]) },
  ];
}
export const TEMPLATES: Template[] = new Proxy([] as Template[], { get: (_t, k) => Reflect.get((cache ??= build()), k) });
