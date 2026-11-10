// An exercise's history for one client: what they did last time (shown as ghost values) and their notes, newest first.
import type { ExerciseRef, LogEntry, SetLog } from './model';

export type PastLog = { performed_at: string; entries: LogEntry[] };
export type ExerciseTime = { at: string; sets: SetLog[]; note: string | null; unit?: 'lb' | 'kg'; sides?: boolean; settings?: Record<string, string> };

export const exKey = (ex: ExerciseRef | undefined) => (ex ? `${ex.src}:${ex.id}` : '');

/** Every time this exercise was done, newest first */
export function historyOf(logs: PastLog[], key: string): ExerciseTime[] {
  if (!key) return [];
  const out: ExerciseTime[] = [];
  for (const l of [...logs].sort((a, b) => b.performed_at.localeCompare(a.performed_at))) {
    for (const e of l.entries ?? []) {
      if (exKey(e.ex) !== key) continue;
      out.push({ at: l.performed_at, sets: e.sets ?? [], note: e.note?.trim() || null, unit: e.unit, sides: e.sides, settings: e.settings });
    }
  }
  return out;
}

/** Notes left on this exercise, newest first (for the ‹ › arrows) */
export const notesOf = (h: ExerciseTime[]) => h.filter((t): t is ExerciseTime & { note: string } => !!t.note).map((t) => ({ at: t.at, note: t.note }));

/** Last time's set, to show greyed out in the same box (falls back to the last set they did) */
export const ghostSet = (h: ExerciseTime[], i: number): SetLog | null => {
  const sets = h[0]?.sets ?? [];
  return sets[i] ?? sets[sets.length - 1] ?? null;
};

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
/** One logged set in words: "25 lb × 10 R · 8 L (left 2 short)" */
export function setLine(s: SetLog, unit?: string): string {
  const two = s.reps_l != null || s.reps_r != null || s.time_l != null || s.time_r != null;
  let what: string | false = false;
  if (two && (s.reps_l != null || s.reps_r != null)) what = `${s.reps_r ?? '–'} R · ${s.reps_l ?? '–'} L reps`;
  else if (two) what = `${s.time_r != null ? mmss(s.time_r) : '–'} R · ${s.time_l != null ? mmss(s.time_l) : '–'} L`;
  else if (s.reps != null) what = `${s.reps} reps`;
  else if (s.time != null) what = mmss(s.time);
  const gapL = s.reps_l != null && s.reps_r != null ? s.reps_r - s.reps_l : null;
  const gap = gapL ? (gapL > 0 ? ` (left ${gapL} short)` : ` (right ${-gapL} short)`) : '';
  return [s.weight != null && `${s.weight} ${unit ?? ''}`.trim(), what, s.distance].filter(Boolean).join(' × ') + gap;
}

/** What this person has swapped an exercise for before, most often first (by reference; older logs by name) */
export function pastSwaps(past: PastLog[], fromRef: string, fromName: string): { ref: string; name: string; uses: number }[] {
  const n = new Map<string, { ref: string; name: string; uses: number }>();
  for (const l of past) for (const e of l.entries) {
    if (!e.ex) continue;
    const hit = e.swapped_from_ref ? e.swapped_from_ref === fromRef : !!e.swapped_from && e.swapped_from.toLowerCase() === fromName.toLowerCase();
    const ref = `${e.ex.src}:${e.ex.id}`;
    if (!hit || ref === fromRef) continue;
    const c = n.get(ref) ?? { ref, name: e.ex.name, uses: 0 };
    c.uses++; n.set(ref, c);
  }
  return [...n.values()].sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
}
