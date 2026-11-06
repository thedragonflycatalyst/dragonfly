// Pure helpers for building, editing and logging workouts (no UI, no network).
import type { ExerciseBlock, ExerciseRef, LogEntry, SetLog, SetMetric, SetSpec, WorkoutBlock } from './model';
import type { LibExercise } from './library';
import { repsOf, usesSides } from './sides';

let seq = 0;
export const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Library or trainer exercise → the reference stored in a workout */
export function refOf(e: LibExercise): ExerciseRef {
  const [src, id] = e.ref.split(/:(.*)/s) as ['lib' | 'my', string];
  return { src, id, name: e.name, img: e.images[0] ?? null, video: e.video ?? null };
}

const STATIC = /\b(plank|hold|hang|wall sit|l-sit|v-sit|hollow body|isometric|front lever|back lever|planche|human flag|handstand|crow|support)\b/i;
const MOVING = /up-down|jack|walk|tap|row|reach|drag|pass|climber|rotation|to |push-up|pull|raise|kick|dip|saw|knee|reverse|crunch|curl|press|negative|ride|swing|thrust|jump|roll|step|march|drive|thread|snatch|clean|lift|twist|spider|abduction|rock|drop|scissors/i;
/** Sensible starting sets for an exercise: 3 × 10 with 60 s rest, 3 × 30 s for holds, stretches and cardio machines,
 *  or distance for carries */
export function defaultMetric(e: Pick<LibExercise, 'category' | 'name' | 'metric' | 'pattern'>): SetMetric {
  if (e.metric) return e.metric;
  const c = e.category.toLowerCase();
  if (e.pattern) {  // library exercises: go by the movement pattern, and planks and holds by name
    if (e.pattern === 'Carry') return 'distance';
    if (['Isometric hold', 'Stretch', 'Cardio machine'].includes(e.pattern) || c === 'cardio' || c === 'stretching') return 'time';
    return STATIC.test(e.name) && !MOVING.test(e.name) ? 'time' : 'reps';
  }
  if (c === 'cardio' || c === 'stretching' || /plank|hold|bridge|wall sit|hang\b/i.test(e.name)) return 'time';
  return 'reps';
}
export function newBlock(e: LibExercise, metric = defaultMetric(e)): ExerciseBlock {
  const set: SetSpec = metric === 'time' ? { time: 30, rest: 30 } : metric === 'distance' ? { distance: '400 m', rest: 60 } : { reps: '10', rest: 60, weight: '' };
  return { id: newId(), kind: 'exercise', ex: refOf(e), metric, sets: [{ ...set }, { ...set }, { ...set }] };
}

/** Adds a set copied from the last one (or a blank set) */
export const addSet = (b: ExerciseBlock): ExerciseBlock => ({ ...b, sets: [...b.sets, { ...(b.sets[b.sets.length - 1] ?? {}) }] });
export const removeSet = (b: ExerciseBlock, i: number): ExerciseBlock => ({ ...b, sets: b.sets.filter((_, n) => n !== i) });

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

/** Copies blocks with fresh ids (for duplicating a workout or a template) */
export const cloneBlocks = (blocks: WorkoutBlock[]): WorkoutBlock[] => blocks.map((b) => ({ ...JSON.parse(JSON.stringify(b)), id: newId() }));

/** Puts the next exercise in the same superset as block i (merging supersets if the next one already has one). */
export function linkNext(blocks: WorkoutBlock[], i: number): WorkoutBlock[] {
  const cur = blocks[i], next = blocks[i + 1];
  if (cur?.kind !== 'exercise' || next?.kind !== 'exercise') return blocks;
  const g = cur.group ?? next.group ?? newId();
  const old = [cur.group, next.group].filter((x) => x && x !== g);
  return normalizeGroups(blocks.map((b, n) => b.kind !== 'exercise' ? b
    : n === i || n === i + 1 || (b.group && old.includes(b.group)) ? { ...b, group: g } : b));
}
/** Takes block i out of its superset. Splitting the middle of a superset leaves two supersets. */
export function unlink(blocks: WorkoutBlock[], i: number): WorkoutBlock[] {
  const cur = blocks[i];
  if (cur?.kind !== 'exercise' || !cur.group) return blocks;
  const g = cur.group, fresh = newId();
  return normalizeGroups(blocks.map((b, n) => b.kind !== 'exercise' ? b
    : n === i ? { ...b, group: null } : n > i && b.group === g ? { ...b, group: fresh } : b));
}
/** Supersets must be unbroken runs of two or more; anything else stands alone. */
export function normalizeGroups(blocks: WorkoutBlock[]): WorkoutBlock[] {
  const out = blocks.map((b) => ({ ...b })) as WorkoutBlock[];
  let i = 0;
  while (i < out.length) {
    const b = out[i];
    if (b.kind !== 'exercise' || !b.group) { i++; continue; }
    let j = i;
    while (j + 1 < out.length && out[j + 1].kind === 'exercise' && (out[j + 1] as ExerciseBlock).group === b.group) j++;
    const runId = j > i ? (out.slice(0, i).some((x) => x.kind === 'exercise' && x.group === b.group) ? newId() : b.group) : null;
    for (let k = i; k <= j; k++) (out[k] as ExerciseBlock).group = runId;
    i = j + 1;
  }
  return out;
}
/** Superset labels in display order: A, B, C… (null for exercises on their own) */
export function supersetLabels(blocks: WorkoutBlock[]): (string | null)[] {
  const map = new Map<string, string>();
  return blocks.map((b) => {
    if (b.kind !== 'exercise' || !b.group) return null;
    if (!map.has(b.group)) map.set(b.group, String.fromCharCode(65 + map.size));
    return map.get(b.group)!;
  });
}

/** "1:30" / "90" / "90s" → 90 seconds; null when not understood */
export function parseSeconds(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/s$/, '');
  if (!t) return null;
  const m = t.match(/^(\d{1,3}):([0-5]\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return /^\d{1,4}$/.test(t) ? Number(t) : null;
}
export const fmtSeconds = (sec: number | null | undefined) => (sec == null ? '' : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`);

/** Rough length of a workout in minutes (about 40 s per rep set, plus holds and rests) */
export function estimateMinutes(blocks: WorkoutBlock[]): number {
  let s = 0;
  for (const b of blocks) {
    if (b.kind === 'exercise') for (const set of b.sets) s += (b.metric === 'time' ? set.time ?? 30 : 40) + (set.rest ?? 60);
    else if (b.kind === 'timed') s += b.timer.rounds * (b.timer.work + b.timer.rest);
  }
  return Math.max(1, Math.round(s / 60));
}
export const exerciseCount = (blocks: WorkoutBlock[]) => blocks.filter((b) => b.kind === 'exercise').length;

/** A blank log for a workout, pre-filled with the planned numbers so the client only adjusts what changed */
export function startLog(blocks: WorkoutBlock[], unit: 'lb' | 'kg'): LogEntry[] {
  const n = (v?: string) => { const m = (v ?? '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
  return blocks.filter((b): b is ExerciseBlock => b.kind === 'exercise').map((b) => {
    const sides = usesSides(b.sides, b.ex.name);
    return {
      block_id: b.id, ex: b.ex, unit, sides,
      sets: b.sets.map((s): SetLog => {
        const reps = b.metric === 'reps' ? n(s.reps) : null, time = b.metric === 'time' ? s.time ?? null : null;
        const rest = s.rest ?? b.sets[b.sets.length - 1]?.rest ?? null;
        return sides
          ? { weight: n(s.weight), reps_l: reps, reps_r: reps, time_l: time, time_r: time, distance: b.metric === 'distance' ? s.distance ?? null : null, done: false, rest }
          : { weight: n(s.weight), reps, time, distance: b.metric === 'distance' ? s.distance ?? null : null, done: false, rest };
      }),
    };
  });
}
export const setsDone = (log: LogEntry[]) => log.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
export const setsTotal = (log: LogEntry[]) => log.reduce((n, e) => n + e.sets.length, 0);
/** Total weight moved (weight × reps over done sets), in the log's unit */
export const volume = (log: LogEntry[]) => Math.round(log.reduce((v, e) => v + e.sets.reduce((w, s) => w + (s.done && s.weight ? s.weight * repsOf(s) : 0), 0), 0));

/** Cover art: gradient presets (no stock photos) */
export const COVERS: [string, string][] = [
  ['#0a7a70', '#3fd6c6'], ['#1b2a4a', '#4f7cff'], ['#5b1d7a', '#d66bff'], ['#8a2a12', '#ff8a4c'],
  ['#1a5c2e', '#7fe08a'], ['#7a5a0a', '#ffd166'], ['#3a0d1f', '#ff5d8f'], ['#20262e', '#9aa5b1'],
];
export function coverColors(cover: string | null | undefined, name: string): [string, string] {
  const m = (cover ?? '').match(/^preset:(\d+)$/);
  if (m) return COVERS[Number(m[1]) % COVERS.length];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COVERS[h % COVERS.length];
}

/** A workout's blocks with one exercise swapped for good: the block with this id, or (if the workout was edited since) the
 *  first block that still uses the old exercise. Sets, notes and grouping stay the same. Returns null when nothing matched. */
export function swapBlock(blocks: WorkoutBlock[], blockId: string, from: ExerciseRef, to: ExerciseRef): WorkoutBlock[] | null {
  const sameEx = (b: WorkoutBlock) => b.kind === 'exercise' && b.ex.src === from.src && b.ex.id === from.id;
  let i = blocks.findIndex((b) => b.id === blockId && b.kind === 'exercise');
  if (i < 0 || !sameEx(blocks[i])) i = blocks.findIndex(sameEx);
  if (i < 0) return null;
  return blocks.map((b, n) => (n === i && b.kind === 'exercise' ? { ...b, ex: to } : b));
}
