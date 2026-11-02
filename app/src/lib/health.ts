// Health data from other apps (Health Connect, Apple Health, Strava, Oura, Whoop, food-app exports): daily totals,
// workouts and food. Pure functions (tested); the device and server code only fetch and convert units.
import { dayKey } from './dates';

/** What a phone's health store gives us, already in plain units */
export type DeviceHealth = {
  steps: { start: string; end: string; count: number }[];
  activeKcal: { start: string; end: string; kcal: number }[];
  distance: { start: string; end: string; m: number }[];
  sleep: { start: string; end: string; asleepMin?: number }[];
  restingHr: { time: string; bpm: number }[];
  hrv: { time: string; ms: number }[];
  water: { start: string; ml: number }[];
  workouts: { id: string; kind: string; title?: string; start: string; end: string; kcal?: number; m?: number; app?: string }[];
  food: { id: string; start: string; meal: string; name: string; kcal: number; protein?: number; carbs?: number; fat?: number; sugar?: number; fibre?: number; sodium?: number; app?: string }[];
};
export const emptyHealth = (): DeviceHealth => ({ steps: [], activeKcal: [], distance: [], sleep: [], restingHr: [], hrv: [], water: [], workouts: [], food: [] });

export type Daily = { day: string; steps?: number; active_kcal?: number; distance_m?: number; sleep_min?: number; resting_hr?: number; hrv_ms?: number; readiness?: number; water_ml?: number };

/** Totals per local day. Sleep counts on the day you wake up; heart rate and HRV are the day's average. */
export function dailyTotals(h: DeviceHealth): Daily[] {
  const days = new Map<string, Daily & { _hr: number[]; _hrv: number[] }>();
  const at = (iso: string) => { const k = dayKey(new Date(iso)); let d = days.get(k); if (!d) { d = { day: k, _hr: [], _hrv: [] }; days.set(k, d); } return d; };
  for (const s of h.steps) { const d = at(s.start); d.steps = (d.steps ?? 0) + s.count; }
  for (const s of h.activeKcal) { const d = at(s.start); d.active_kcal = (d.active_kcal ?? 0) + s.kcal; }
  for (const s of h.distance) { const d = at(s.start); d.distance_m = (d.distance_m ?? 0) + s.m; }
  for (const s of h.sleep) {
    const mins = s.asleepMin ?? (new Date(s.end).getTime() - new Date(s.start).getTime()) / 60_000;
    if (mins > 0 && mins < 1440) { const d = at(s.end); d.sleep_min = (d.sleep_min ?? 0) + mins; }
  }
  for (const r of h.restingHr) at(r.time)._hr.push(r.bpm);
  for (const r of h.hrv) at(r.time)._hrv.push(r.ms);
  for (const w of h.water) { const d = at(w.start); d.water_ml = (d.water_ml ?? 0) + w.ml; }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : undefined);
  return [...days.values()].map(({ _hr, _hrv, ...d }) => {
    const out: Daily = { day: d.day };
    if (d.steps != null) out.steps = Math.min(Math.round(d.steps), 200000);
    if (d.active_kcal != null) out.active_kcal = Math.min(Math.round(d.active_kcal), 20000);
    if (d.distance_m != null) out.distance_m = Math.min(Math.round(d.distance_m), 1000000);
    if (d.sleep_min != null) out.sleep_min = Math.min(Math.round(d.sleep_min), 1440);
    if (d.water_ml != null) out.water_ml = Math.min(Math.round(d.water_ml), 20000);
    const hr = avg(_hr), hrv = avg(_hrv);
    if (hr != null && hr >= 20 && hr <= 250) out.resting_hr = Math.round(hr);
    if (hrv != null && hrv <= 500) out.hrv_ms = Math.round(hrv * 10) / 10;
    return out;
  }).sort((a, b) => a.day.localeCompare(b.day));
}

/** Combines a new day's numbers with what's already stored (from another source): keep the larger count, newest averages */
export function mergeDaily(old: Daily | undefined, add: Daily): Daily {
  if (!old) return add;
  const max = (a?: number, b?: number) => (a == null ? b : b == null ? a : Math.max(a, b));
  return { day: add.day, steps: max(old.steps, add.steps), active_kcal: max(old.active_kcal, add.active_kcal), distance_m: max(old.distance_m, add.distance_m),
    sleep_min: add.sleep_min ?? old.sleep_min, resting_hr: add.resting_hr ?? old.resting_hr, hrv_ms: add.hrv_ms ?? old.hrv_ms, readiness: add.readiness ?? old.readiness, water_ml: max(old.water_ml, add.water_ml) };
}

/** Food entries in the shape of the diary (coach_food_logs), with an id so re-syncing doesn't duplicate them */
export function foodRows(h: Pick<DeviceHealth, 'food'>, prefix: string) {
  return h.food.filter((f) => f.kcal >= 0 && f.name).map((f) => ({
    eaten_on: dayKey(new Date(f.start)), meal: f.meal, name: f.name.slice(0, 200), external_id: `${prefix}:${f.id}`.slice(0, 200),
    n: { kcal: Math.round(f.kcal), protein: r1(f.protein), carbs: r1(f.carbs), fat: r1(f.fat), sugar: r1(f.sugar), fibre: r1(f.fibre), sodium: f.sodium == null ? 0 : Math.round(f.sodium) },
    note: f.app ? `From ${f.app}` : null,
  }));
}
const r1 = (n?: number) => (n == null || !Number.isFinite(n) ? 0 : Math.round(n * 10) / 10);
export const mealName = (n: number | string | undefined) => {
  const s = String(n ?? '').toLowerCase();
  if (s === '1' || s.startsWith('break')) return 'Breakfast';
  if (s === '2' || s.startsWith('lunch')) return 'Lunch';
  if (s === '3' || s.startsWith('dinner') || s.startsWith('supper')) return 'Dinner';
  return 'Snacks';
};

/* ---------------- food app CSV exports ---------------- */
const COLS: [RegExp, string][] = [
  [/^(day|date)$/i, 'date'], [/^time$/i, 'time'], [/^(group|meal|type)$/i, 'meal'], [/^(food ?name|name|food|description|item)$/i, 'name'],
  [/^(energy \(kcal\)|calories|kcal|energy)$/i, 'kcal'], [/^protein/i, 'protein'], [/^(carbs|carbohydrates?)/i, 'carbs'], [/^fat( \(g\))?$/i, 'fat'],
  [/^(fib(er|re))/i, 'fibre'], [/^sugars?/i, 'sugar'], [/^sodium/i, 'sodium'], [/^(amount|quantity|serving)/i, 'amount'], [/^units?$/i, 'units'],
];
function split(line: string, sep: string) {
  const out: string[] = []; let cur = '', q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out.map((s) => s.trim());
}
const num = (s?: string) => { const v = parseFloat(String(s ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(v) ? v : undefined; };
function parseDay(s: string): string | null {
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}
/** Reads a food diary export (Cronometer "Servings", MyFitnessPal "Nutrition", Lose It, or a spreadsheet). One row per food (or per meal). */
export function parseFoodCsv(text: string): { rows: DeviceHealth['food']; skipped: number; app: string } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const hi = lines.findIndex((l) => /(date|day)/i.test(l) && /(calories|energy|kcal)/i.test(l));
  if (hi < 0) return { rows: [], skipped: 0, app: '' };
  const sep = [',', ';', '\t'].map((s) => [s, lines[hi].split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const head = split(lines[hi], sep);
  const col: Record<string, number> = {};
  head.forEach((h, i) => { const hit = COLS.find(([re]) => re.test(h.replace(/"/g, ''))); if (hit && col[hit[1]] === undefined) col[hit[1]] = i; });
  const app = /Energy \(kcal\)/i.test(lines[hi]) && /Group/i.test(lines[hi]) ? 'Cronometer' : /Carbohydrates \(g\)/i.test(lines[hi]) && /Meal/i.test(lines[hi]) ? 'MyFitnessPal' : /Name/.test(lines[hi]) && /Type/.test(lines[hi]) ? 'Lose It' : 'food app';
  if (col.date === undefined || col.kcal === undefined) return { rows: [], skipped: 0, app };
  const rows: DeviceHealth['food'] = []; let skipped = 0;
  lines.slice(hi + 1).forEach((l, i) => {
    const f = split(l, sep);
    const day = parseDay(f[col.date] ?? ''), kcal = num(f[col.kcal]);
    if (!day || kcal == null || kcal < 0 || kcal > 20000) { skipped++; return; }
    const meal = mealName(col.meal !== undefined ? f[col.meal] : undefined);
    const name = (col.name !== undefined && f[col.name]) || `${meal} (${app})`;
    const amount = [col.amount !== undefined ? f[col.amount] : '', col.units !== undefined ? f[col.units] : ''].filter(Boolean).join(' ');
    const time = col.time !== undefined && /^\d{1,2}:\d{2}/.test(f[col.time] ?? '') ? f[col.time].slice(0, 5).padStart(5, '0') : '12:00';
    rows.push({ id: `${day}|${meal}|${name}|${kcal}|${i}`, start: new Date(`${day}T${time}:00`).toISOString(), meal, name: amount ? `${name}, ${amount}` : name,
      kcal, protein: num(f[col.protein]), carbs: num(f[col.carbs]), fat: num(f[col.fat]), sugar: num(f[col.sugar]), fibre: num(f[col.fibre]), sodium: num(f[col.sodium]), app });
  });
  return { rows, skipped, app };
}

/* ---------------- showing it ---------------- */
export const fmtSleep = (min?: number | null) => (min == null ? '–' : `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`);
export const PROVIDERS = {
  health_connect: 'Health Connect', apple_health: 'Apple Health', strava: 'Strava', oura: 'Oura', whoop: 'WHOOP', garmin: 'Garmin',
} as const;
/** Check-in signals from synced data: short sleep, steps dropping, resting heart rate creeping up */
export function healthSignals(days: Daily[], today = dayKey(new Date())): { text: string; level: 'warn' | 'good' }[] {
  const recent = days.filter((d) => d.day <= today).sort((a, b) => b.day.localeCompare(a.day));
  const week = recent.slice(0, 7), before = recent.slice(7, 28);
  const avg = (list: Daily[], k: keyof Daily) => { const v = list.map((d) => d[k]).filter((x): x is number => typeof x === 'number'); return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const out: { text: string; level: 'warn' | 'good' }[] = [];
  const sleep = avg(week, 'sleep_min');
  if (sleep != null && sleep < 6 * 60) out.push({ text: `Sleeping ${fmtSleep(sleep)} a night`, level: 'warn' });
  else if (sleep != null && sleep >= 7 * 60) out.push({ text: `Sleeping well (${fmtSleep(sleep)})`, level: 'good' });
  const s1 = avg(week, 'steps'), s0 = avg(before, 'steps');
  if (s1 != null && s0 != null && s0 > 2000 && s1 < s0 * 0.7) out.push({ text: `Steps down ${Math.round((1 - s1 / s0) * 100)}% this week`, level: 'warn' });
  else if (s1 != null && s1 >= 8000) out.push({ text: `${Math.round(s1).toLocaleString()} steps a day`, level: 'good' });
  const h1 = avg(week, 'resting_hr'), h0 = avg(before, 'resting_hr');
  if (h1 != null && h0 != null && h1 - h0 >= 5) out.push({ text: `Resting heart rate up ${Math.round(h1 - h0)} bpm`, level: 'warn' });
  return out;
}
