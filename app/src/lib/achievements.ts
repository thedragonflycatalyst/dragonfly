// What a finished session achieved: personal records, volume against last time, streak, sessions this month and milestones.
// Pure functions (no I/O) so they can be tested and used on any screen that has the logs.
import { exKey, type PastLog } from './history';
import type { LogEntry, SetLog } from './model';

const LB_TO_KG = 0.45359237;

export type Pr = {
  key: string; name: string;
  kind: 'weight' | 'reps' | 'time';
  /** in the entry's own unit (weight) or reps / seconds */
  value: number; prev: number; unit?: 'lb' | 'kg';
};
export type Summary = {
  prs: Pr[];
  /** total weight × reps, in kg (convert for display) */
  volumeKg: number;
  /** the previous session's volume in kg, or null if this is the first */
  prevVolumeKg: number | null;
  /** consecutive weeks (Mon–Sun) up to this one with at least one session */
  streakWeeks: number;
  sessionsThisMonth: number;
  /** this is session number N for the client */
  sessionNumber: number;
  /** stable keys, e.g. "sessions:10", "streak:4", "first_pr" */
  milestones: string[];
};

const repsOf = (s: SetLog): number | null =>
  s.reps ?? (s.reps_l != null || s.reps_r != null ? (s.reps_l ?? 0) + (s.reps_r ?? 0) : null);
const timeOf = (s: SetLog): number | null =>
  s.time ?? (s.time_l != null || s.time_r != null ? Math.max(s.time_l ?? 0, s.time_r ?? 0) : null);
const toKg = (w: number, unit?: 'lb' | 'kg') => (unit === 'lb' ? w * LB_TO_KG : w);

/** Weight × reps for one exercise, in kg (bodyweight and timed sets add nothing) */
export function entryVolumeKg(e: LogEntry): number {
  let v = 0;
  for (const s of e.sets ?? []) {
    if (s.done === false) continue;
    const r = repsOf(s);
    if (s.weight != null && s.weight > 0 && r) v += toKg(s.weight, e.unit) * r;
  }
  return v;
}
export const sessionVolumeKg = (entries: LogEntry[]) => entries.reduce((t, e) => t + entryVolumeKg(e), 0);

type Best = { weightKg: number; weight: number; unit?: 'lb' | 'kg'; reps: number; time: number; weighted: boolean };
function bestOf(sets: SetLog[], unit?: 'lb' | 'kg'): Best {
  const b: Best = { weightKg: 0, weight: 0, unit, reps: 0, time: 0, weighted: false };
  for (const s of sets) {
    if (s.done === false) continue;
    const r = repsOf(s) ?? 0;
    if (s.weight != null && s.weight > 0) {
      b.weighted = true;
      if (r > 0 || timeOf(s)) {
        const kg = toKg(s.weight, unit);
        if (kg > b.weightKg) { b.weightKg = kg; b.weight = s.weight; }
      }
    }
    b.reps = Math.max(b.reps, r);
    b.time = Math.max(b.time, timeOf(s) ?? 0);
  }
  return b;
}

/** Personal records in this session, compared with every earlier session (first time doing an exercise is not a record) */
export function findPrs(current: PastLog, earlier: PastLog[]): Pr[] {
  const out: Pr[] = [];
  const before = earlier.filter((l) => l.performed_at < current.performed_at);
  for (const e of current.entries ?? []) {
    const key = exKey(e.ex);
    if (!key) continue;
    const now = bestOf(e.sets ?? [], e.unit);
    let prev: Best | null = null;
    for (const l of before) for (const pe of l.entries ?? []) {
      if (exKey(pe.ex) !== key) continue;
      const b = bestOf(pe.sets ?? [], pe.unit);
      prev = prev ? {
        weightKg: Math.max(prev.weightKg, b.weightKg), weight: b.weightKg > prev.weightKg ? b.weight : prev.weight, unit: b.weightKg > prev.weightKg ? b.unit : prev.unit,
        reps: Math.max(prev.reps, b.reps), time: Math.max(prev.time, b.time), weighted: prev.weighted || b.weighted,
      } : b;
    }
    if (!prev) continue;
    const name = e.ex?.name ?? 'Exercise';
    // Heavier than ever (a small tolerance so lb/kg rounding never makes a false record)
    if (now.weightKg > 0 && now.weightKg > prev.weightKg + 0.01) {
      const prevShown = Math.round((prev.weightKg / (e.unit === 'lb' ? LB_TO_KG : 1)) * 10) / 10;
      out.push({ key, name, kind: 'weight', value: now.weight, prev: prevShown, unit: e.unit });
    } else if (!now.weighted && !prev.weighted && now.reps > prev.reps && now.reps > 0) {
      out.push({ key, name, kind: 'reps', value: now.reps, prev: prev.reps });
    } else if (!now.weighted && now.time > prev.time && now.time > 0 && now.reps === 0) {
      out.push({ key, name, kind: 'time', value: now.time, prev: prev.time });
    }
  }
  return out;
}

/** Monday 00:00 (local) of the week containing d, as yyyy-mm-dd */
function weekStart(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function prevWeek(ws: string): string {
  const [y, m, d] = ws.split('-').map(Number);
  return weekStart(new Date(y, m - 1, d - 7));
}

/** Consecutive weeks with a session, counting back from the week of `at` */
export function streakWeeks(dates: string[], at: string): number {
  const weeks = new Set(dates.map((t) => weekStart(new Date(t))));
  let w = weekStart(new Date(at));
  let n = 0;
  while (weeks.has(w)) { n++; w = prevWeek(w); }
  return n;
}

const SESSION_MARKS = [1, 5, 10, 25, 50, 75, 100];
const STREAK_MARKS = [4, 8, 12, 26, 52];

/** The full summary for `current`; `all` is every log for the client (may include `current`) */
export function summarize(current: PastLog, all: PastLog[]): Summary {
  const others = all.filter((l) => l !== current && l.performed_at !== current.performed_at);
  const earlier = others.filter((l) => l.performed_at < current.performed_at).sort((a, b) => b.performed_at.localeCompare(a.performed_at));
  const upToNow = [...earlier, current];
  const prs = findPrs(current, earlier);
  const at = new Date(current.performed_at);
  const sessionsThisMonth = upToNow.filter((l) => { const d = new Date(l.performed_at); return d.getFullYear() === at.getFullYear() && d.getMonth() === at.getMonth(); }).length;
  const streak = streakWeeks(upToNow.map((l) => l.performed_at), current.performed_at);
  const sessionNumber = upToNow.length;
  const milestones: string[] = [];
  if (SESSION_MARKS.includes(sessionNumber) || (sessionNumber > 100 && sessionNumber % 50 === 0)) milestones.push(`sessions:${sessionNumber}`);
  const prevStreak = earlier.length ? streakWeeks(earlier.map((l) => l.performed_at), earlier[0].performed_at) : 0;
  if (STREAK_MARKS.includes(streak) && streak > prevStreak) milestones.push(`streak:${streak}`);
  if (prs.length) {
    const hadPr = earlier.some((l, i) => findPrs(l, earlier.slice(i + 1)).length > 0);
    if (!hadPr) milestones.push('first_pr');
  }
  return {
    prs, volumeKg: Math.round(sessionVolumeKg(current.entries ?? []) * 10) / 10,
    prevVolumeKg: earlier.length ? Math.round(sessionVolumeKg(earlier[0].entries ?? []) * 10) / 10 : null,
    streakWeeks: streak, sessionsThisMonth, sessionNumber, milestones,
  };
}

/** Plain words for a milestone key */
export function milestoneText(key: string): string {
  const [kind, n] = key.split(':');
  if (kind === 'sessions') return n === '1' ? 'First session done' : `${n}th session`;
  if (kind === 'streak') return `${n}-week streak`;
  if (kind === 'first_pr') return 'First personal record';
  return key;
}

/** "Heaviest yet: 135 lb (was 125)" */
export function prText(p: Pr): string {
  if (p.kind === 'weight') return `Heaviest yet: ${p.value} ${p.unit ?? ''}`.trim() + (p.prev ? ` (was ${p.prev})` : '');
  if (p.kind === 'reps') return `Most reps yet: ${p.value} (was ${p.prev})`;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  return `Longest yet: ${mmss(p.value)} (was ${mmss(p.prev)})`;
}

/** Display a kg volume in the person's unit */
export const volumeIn = (kg: number, unit: 'lb' | 'kg') => Math.round(unit === 'lb' ? kg / LB_TO_KG : kg);
