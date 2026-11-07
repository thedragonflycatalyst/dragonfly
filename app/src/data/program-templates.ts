// Dragonfly program templates: multi-week plans a trainer copies into their own programs and adjusts.
// Each workout uses library exercise IDs (checked by program-templates.test.ts). Loads are left blank for the trainer
// to set; the progression note says how to move them on week to week.
import type { ProgramDay, WorkoutBlock } from '../lib/model';
import { make, type Line } from './templates';

export type ProgramWorkout = { name: string; description: string; blocks: WorkoutBlock[] };
export type ProgramTemplate = {
  key: string; name: string; focus: string; level: 'beginner' | 'intermediate' | 'all levels'; weeks: number; perWeek: number;
  description: string; progression: string; cover: string;
  workouts: ProgramWorkout[];
  /** Which workout (index) on which day of the week (1 = Monday), repeated every week */
  days: { day: number; workout: number }[];
  /** Optional deload: in these weeks sets drop by about a third (noted on the workouts) */
  deloadWeeks?: number[];
};

const w = (name: string, description: string, lines: (Line | Line[])[]): ProgramWorkout => ({ name, description, blocks: make(lines) });

let cache: ProgramTemplate[] | null = null;
function build(): ProgramTemplate[] {
  return [
    {
      key: 'strength-3x', name: 'Foundations of Strength', focus: 'Strength', level: 'intermediate', weeks: 8, perWeek: 3, cover: 'preset:0',
      description: 'Three full-body days built on the squat, hinge, press and pull, with heavy sets of 3–6.',
      progression: 'Add 2.5–5 kg (5–10 lb) to the main lift when every set hits the top of the rep range with good form. Week 4 and week 8 are lighter (deload).',
      deloadWeeks: [4, 8],
      workouts: [
        w('Strength A', 'Squat focus.', [['c-barbell-high-bar-back-squat', 4, '5', 180], ['c-barbell-bench-press', 4, '5', 180], ['c-pendlay-row', 3, '6', 120], ['c-forearm-plank', 3, 40, 45]]),
        w('Strength B', 'Hinge focus.', [['c-conventional-deadlift', 3, '4', 240], ['c-barbell-overhead-press', 4, '5', 150], ['c-pull-up', 4, '4-6', 120], ['c-farmer-s-walk', 3, 40, 90]]),
        w('Strength C', 'Single-leg and volume.', [['c-barbell-high-bar-back-squat', 3, '6', 150], ['c-dumbbell-bulgarian-split-squat', 3, '6 each leg', 90], ['c-dumbbell-bench-press', 3, '8', 120], ['c-chin-up', 3, '6', 120], ['c-romanian-deadlift', 3, '8', 120]]),
      ],
      days: [{ day: 1, workout: 0 }, { day: 3, workout: 1 }, { day: 5, workout: 2 }],
    },
    {
      key: 'hypertrophy-4x', name: 'Build Muscle: Upper / Lower', focus: 'Hypertrophy', level: 'intermediate', weeks: 8, perWeek: 4, cover: 'preset:1',
      description: 'Four days a week, upper and lower body twice each, 8–15 reps taken close to failure.',
      progression: 'Keep the weight until every set reaches the top of the range, then add the smallest jump. Leave 1–2 reps in reserve. Week 8 is a deload.',
      deloadWeeks: [8],
      workouts: [
        w('Upper 1', 'Chest and back emphasis.', [['c-incline-dumbbell-bench-press', 4, '8-10', 120], ['c-seated-cable-row', 4, '10-12', 90], [['c-pec-deck', 3, '12-15', 30], ['c-cable-face-pull', 3, '15', 60]], [['c-dumbbell-biceps-curl', 3, '12', 30], ['c-straight-bar-triceps-pushdown', 3, '12', 60]]]),
        w('Lower 1', 'Quads emphasis.', [['c-leg-press', 4, '10-12', 120], ['c-romanian-deadlift', 3, '8-10', 120], ['c-dumbbell-walking-lunge', 3, '10 each leg', 90], [['c-leg-extension', 3, '15', 30], ['c-lying-leg-curl', 3, '12', 60]], ['c-standing-calf-raise', 4, '12-15', 45]]),
        w('Upper 2', 'Shoulders and arms emphasis.', [['c-lat-pulldown', 4, '8-10', 90], ['c-seated-dumbbell-shoulder-press', 4, '8-10', 120], ['c-chest-dip', 3, '8-12', 90], [['c-dumbbell-lateral-raise', 4, '15', 30], ['c-overhead-cable-triceps-extension', 3, '12', 60]]]),
        w('Lower 2', 'Glutes and hamstrings emphasis.', [['c-barbell-hip-thrust', 4, '8-10', 120], ['c-goblet-squat', 3, '12', 90], ['c-seated-leg-curl', 3, '12', 75], ['c-dumbbell-bulgarian-split-squat', 3, '10 each leg', 90], ['c-standing-calf-raise', 3, '15', 45]]),
      ],
      days: [{ day: 1, workout: 0 }, { day: 2, workout: 1 }, { day: 4, workout: 2 }, { day: 5, workout: 3 }],
    },
    {
      key: 'fat-loss-3x', name: 'Lean and Conditioned', focus: 'Fat loss', level: 'all levels', weeks: 6, perWeek: 3, cover: 'preset:2',
      description: 'Strength circuits and intervals that keep the heart rate up. Pair with the nutrition plan; training alone rarely drives fat loss.',
      progression: 'Each week add one round or 5 seconds of work per interval, or a slightly heavier weight, as long as form holds.',
      workouts: [
        w('Circuit A', 'Move between paired exercises with little rest.', [[['c-goblet-squat', 3, '12', 0], ['c-push-up', 3, '10', 45]], [['c-russian-kettlebell-swing', 3, '15', 0], ['c-band-row', 3, '15', 45]], ['c-mountain-climber', 3, 30, 30]]),
        w('Intervals', '20–30 minutes. Work hard, recover fully.', [['c-air-bike', 8, 30, 60, 'Hard effort, then easy pedalling'], ['c-jump-rope', 4, 45, 45], ['c-forearm-plank', 3, 40, 30]]),
        w('Circuit B', 'Full body with carries.', [[['c-dumbbell-step-up', 3, '10 each leg', 0], ['c-kettlebell-thruster', 3, '10', 45]], [['c-dumbbell-romanian-deadlift', 3, '12', 0], ['c-burpee', 3, '8', 45]], ['c-farmer-s-walk', 3, 40, 60]]),
      ],
      days: [{ day: 1, workout: 0 }, { day: 3, workout: 1 }, { day: 5, workout: 2 }],
    },
    {
      key: 'trx-3x', name: 'Suspension Strength', focus: 'TRX', level: 'all levels', weeks: 6, perWeek: 3, cover: 'preset:4',
      description: 'Everything on the suspension trainer. Step closer to the anchor to make pulls and squats harder; farther for presses.',
      progression: 'Change body angle before adding reps. When 3 × 15 is easy at a steep angle, move to the single-leg or power version.',
      workouts: [
        w('TRX Push and Legs', '', [['c-trx-squat', 3, '15', 45], ['c-trx-chest-press', 3, '12', 45], ['c-trx-lunge', 3, '10 each leg', 45], ['c-trx-push-up', 3, '10', 60], ['c-trx-plank', 3, 30, 30]]),
        w('TRX Pull and Core', '', [['c-trx-mid-row', 3, '12', 45], ['c-trx-low-row', 3, '12', 45], [['c-trx-y-fly', 3, '12', 15], ['c-trx-biceps-curl', 3, '12', 45]], ['c-trx-pike', 3, '10', 45], ['c-trx-side-plank', 3, 30, 30, 'Each side']]),
        w('TRX Power', 'Faster, still controlled.', [['c-trx-squat-jump', 3, '10', 60], ['c-trx-power-pull', 3, '8 each side', 60], ['c-trx-balance-lunge', 3, '8 each leg', 45], ['c-trx-hamstring-curl', 3, '12', 45], ['c-trx-mountain-climber', 3, 30, 30]]),
      ],
      days: [{ day: 1, workout: 0 }, { day: 3, workout: 1 }, { day: 5, workout: 2 }],
    },
    {
      key: 'pilates-3x', name: 'Pilates Core: Mat, Reformer and Chair', focus: 'Pilates', level: 'beginner', weeks: 6, perWeek: 3, cover: 'preset:5',
      description: 'A mat class, a reformer class and a chair class each week. Use only the apparatus days your client has access to.',
      progression: 'Add repetitions (up to 10) before adding spring or range. Move to the next level of each exercise when control is consistent.',
      workouts: [
        w('Mat', 'Classical order, beginner level.', [['c-pilates-hundred', 1, 100, 0, '100 breaths'], ['c-pilates-roll-up', 1, '6', 0], ['c-single-leg-circles', 1, '5 each way, each leg', 0], ['c-rolling-like-a-ball', 1, '8', 0], ['c-pilates-single-leg-stretch', 1, '10', 0], ['c-pilates-double-leg-stretch', 1, '8', 0], ['c-spine-stretch-forward', 1, '5', 0], ['c-pilates-saw', 1, '4 each side', 0], ['c-pilates-swan', 1, '5', 0], ['c-pilates-shoulder-bridge', 1, '5 each leg', 0], ['c-side-kick-front-and-back', 1, '8 each side', 0], ['c-pilates-seal', 1, '8', 0]]),
        w('Reformer', 'Light to medium springs.', [['c-reformer-footwork-toes', 1, '10', 0], ['c-reformer-footwork-parallel-heels', 1, '10', 0], ['c-reformer-hundred', 1, 100, 0, '100 breaths'], ['c-reformer-bridging', 1, '8', 0], ['c-reformer-leg-circles', 1, '6 each way', 0], ['c-reformer-rowing-front', 1, '6', 0], ['c-reformer-elephant', 1, '8', 0], ['c-reformer-knee-stretch-round-back', 1, '10', 0], ['c-reformer-side-splits', 1, '8', 0], ['c-reformer-mermaid', 1, '3 each side', 0]]),
        w('Chair', 'Balance and strength on the chair.', [['c-chair-footwork', 1, '10', 0], ['c-chair-step-up', 1, '6 each leg', 0], ['c-chair-side-lunge', 1, '6 each side', 0], ['c-chair-pike', 1, '6', 0], ['c-chair-swan', 1, '5', 0], ['c-chair-triceps-press', 1, '8', 0], ['c-chair-teaser', 1, '5', 0], ['c-chair-seated-mermaid', 1, '3 each side', 0]]),
      ],
      days: [{ day: 1, workout: 0 }, { day: 3, workout: 1 }, { day: 5, workout: 2 }],
    },
    {
      key: 'yoga-3x', name: 'Yoga Flow and Mobility', focus: 'Yoga', level: 'all levels', weeks: 6, perWeek: 3, cover: 'preset:6',
      description: 'A strength flow, a balance flow and a restorative session each week. Breathe through the nose and hold each pose for the time given.',
      progression: 'Lengthen holds by 5–10 seconds a week, or flow through one more round of the salutations.',
      workouts: [
        w('Strength Flow', '', [['c-sun-salutation-a', 3, '1 round', 0], ['c-chair-pose', 3, 30, 15], ['c-warrior-i', 2, 30, 0, 'Each side'], ['c-warrior-ii', 2, 30, 0, 'Each side'], ['c-reverse-warrior', 2, 20, 0, 'Each side'], ['c-extended-side-angle', 2, 30, 0, 'Each side'], ['c-bridge-pose', 3, 30, 15], ['c-child-s-pose', 1, 60, 0]]),
        w('Balance Flow', '', [['c-sun-salutation-b', 2, '1 round', 0], ['c-tree-pose', 2, 30, 0, 'Each side'], ['c-high-lunge', 2, 30, 0, 'Each side'], ['c-half-moon-pose', 2, 20, 0, 'Each side'], ['c-triangle-pose', 2, 30, 0, 'Each side'], ['c-goddess-pose', 2, 30, 15], ['c-garland-pose', 1, 45, 0], ['c-corpse-pose', 1, 180, 0]]),
        w('Restore', 'Slow and easy.', [['c-cat-cow', 1, 60, 0], ['c-thread-the-needle', 1, 45, 0, 'Each side'], ['c-low-lunge', 1, 45, 0, 'Each side'], ['c-pigeon-stretch', 1, 60, 0, 'Each side'], ['c-seated-forward-fold', 1, 60, 0], ['c-supine-spinal-twist', 1, 45, 0, 'Each side'], ['c-happy-baby', 1, 45, 0], ['c-legs-up-the-wall', 1, 180, 0], ['c-corpse-pose', 1, 180, 0]]),
      ],
      days: [{ day: 1, workout: 0 }, { day: 3, workout: 1 }, { day: 6, workout: 2 }],
    },
    {
      key: 'aquatics-3x', name: 'Pool Fitness', focus: 'Aquatics', level: 'all levels', weeks: 6, perWeek: 3, cover: 'preset:3',
      description: 'Low-impact training in chest-deep water, plus one deep-water conditioning day. Water resistance grows with speed, so moving faster makes it harder.',
      progression: 'Move faster or use larger range before adding time. Add webbed gloves or aqua dumbbells in week 3.',
      workouts: [
        w('Shallow Water Strength', 'Chest-deep water.', [['c-water-walking', 1, 300, 0, 'Warm-up'], ['c-pool-squat-jump', 3, '12', 30], ['c-pool-lunges', 3, '10 each leg', 30], ['c-wall-push-up-in-pool', 3, '12', 30], [['c-aqua-dumbbell-bicep-curl', 3, '15', 0], ['c-aqua-dumbbell-push-down', 3, '15', 30]], ['c-pool-calf-raises', 3, '15', 30], ['c-pool-wall-sit', 3, 30, 30]]),
        w('Cardio Intervals', '', [['c-water-walking', 1, 180, 0, 'Warm-up'], [['c-aqua-high-knees', 6, 30, 0], ['c-water-jumping-jacks', 6, 30, 30]], ['c-pool-cross-country-ski', 4, 45, 30], ['c-pool-side-shuffle', 4, 30, 30], ['c-aqua-mountain-climbers', 3, 30, 30]]),
        w('Deep Water', 'Use a flotation belt or noodle.', [['c-water-treading-eggbeater', 3, 60, 30], ['c-deep-water-running', 6, 60, 30], ['c-noodle-seated-cycling', 3, 60, 30], ['c-noodle-crunch', 3, '15', 30]]),
      ],
      days: [{ day: 2, workout: 0 }, { day: 4, workout: 1 }, { day: 6, workout: 2 }],
    },
    {
      key: 'active-aging-2x', name: 'Strong and Steady (Active Aging)', focus: 'Active aging', level: 'beginner', weeks: 8, perWeek: 2, cover: 'preset:5',
      description: 'Strength, balance and everyday movement for older adults. Keep a sturdy chair or rail nearby for support. Clear any medical conditions with the client’s doctor first.',
      progression: 'Progress one thing at a time: reps first (up to 15), then load, then less support on balance work.',
      workouts: [
        w('Strength and Balance A', '', [['c-seated-march', 2, 45, 30, 'Warm-up'], ['c-goblet-box-squat', 3, '8-10', 90, 'Sit to a box or chair and stand up'], ['c-wall-push-up', 3, '10', 60], ['c-band-row', 3, '12', 60], ['c-glute-bridge', 3, '10', 60], ['c-single-leg-balance', 3, 20, 30, 'Each leg, hand near support'], ['c-farmer-s-walk', 2, 30, 60]]),
        w('Strength and Balance B', '', [['c-cat-cow', 1, 60, 0, 'Warm-up'], ['c-dumbbell-step-up', 3, '8 each leg', 90, 'Low step'], ['c-seated-dumbbell-shoulder-press', 3, '10', 60], ['c-bird-dog', 3, '6 each side', 45], ['c-standing-calf-raise', 3, '12', 45], ['c-tandem-stance', 3, 20, 30, 'Heel to toe, hand near support'], ['c-band-pull-apart', 2, '15', 45]]),
      ],
      days: [{ day: 2, workout: 0 }, { day: 5, workout: 1 }],
    },
  ];
}
export const PROGRAM_TEMPLATES: ProgramTemplate[] = new Proxy([] as ProgramTemplate[], { get: (_t, k) => Reflect.get((cache ??= build()), k), has: (_t, k) => Reflect.has((cache ??= build()), k) });

/** The program schedule for a template once its workouts exist (ids in the same order as template.workouts) */
export function scheduleFor(t: ProgramTemplate, workoutIds: string[]): ProgramDay[] {
  const out: ProgramDay[] = [];
  for (let week = 1; week <= t.weeks; week++) {
    for (const d of t.days) out.push({ week, day: d.day, kind: 'workout', workout_id: workoutIds[d.workout] });
    if (t.deloadWeeks?.includes(week)) out.push({ week, day: t.days[0].day, kind: 'note', title: 'Deload week', details: 'About a third fewer sets this week and lighter loads. Recover, then push on next week.' });
  }
  return out;
}
