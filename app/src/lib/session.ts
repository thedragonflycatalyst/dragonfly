import type { ExerciseBlock, LogEntry, ProgramDay, WorkoutBlock } from './model';

/** Put a workout on (or clear) one day of a program; one workout per day. */
export function setDay(schedule: ProgramDay[], week: number, day: number, workoutId: string | null): ProgramDay[] {
  const rest = schedule.filter((s) => !(s.week === week && s.day === day));
  const next = workoutId ? [...rest, { week, day, workout_id: workoutId }] : rest;
  return next.sort((a, b) => a.week - b.week || a.day - b.day);
}
/** Copy week `from` onto week `to`, replacing what was there */
export const copyWeek = (schedule: ProgramDay[], from: number, to: number): ProgramDay[] =>
  [...schedule.filter((s) => s.week !== to), ...schedule.filter((s) => s.week === from).map((s) => ({ ...s, week: to }))].sort((a, b) => a.week - b.week || a.day - b.day);
/** Drop days past the program's length */
export const trimWeeks = (schedule: ProgramDay[], weeks: number) => schedule.filter((s) => s.week <= weeks);

/** Planned rest after a set, in seconds (default 60) */
export function restAfter(blocks: WorkoutBlock[], blockId: string, set: number): number {
  const b = blocks.find((x): x is ExerciseBlock => x.kind === 'exercise' && x.id === blockId);
  return b?.sets[set]?.rest ?? b?.sets[b.sets.length - 1]?.rest ?? 60;
}

/** Elapsed time as h:mm:ss or m:ss */
export function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Keep only sets that were done, and exercises with at least one */
export const doneOnly = (log: LogEntry[]): LogEntry[] => log.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length);

/** An unfinished workout kept on the device so closing the app doesn't lose it */
export type Draft = { key: string; title: string; params: Record<string, string>; client_id: string | null; started: number; log: LogEntry[] };
export const DRAFT_KEY = 'dragonfly.session';
export function readDraft(get: (k: string) => string | null): Draft | null {
  try { const d = JSON.parse(get(DRAFT_KEY) ?? 'null'); return d && typeof d.key === 'string' && Array.isArray(d.log) ? d : null; } catch { return null; }
}
