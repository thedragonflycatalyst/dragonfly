// Scale tab: weigh-ins with optional smart-scale (bio-impedance) readings, a smoothed trend, goal projection and stats.
// Everything is stored metric (kg); shown in the person's bodyweight unit.

export type Weighin = { id: string; user_id: string; measured_at: string; weight_kg: number; metrics: Partial<Record<ReadingKey, number>>; source: 'manual' | 'import' | 'health_connect'; note: string | null };
export type ScaleSettings = { user_id: string; metrics: MetricKey[]; goal_kg: number | null; goal_date: string | null; height_cm: number | null; sex: 'male' | 'female' | 'other' | null; reminder_on: boolean; reminder_time: string };
export type BodyUnit = 'lb' | 'kg' | 'st';

/** Keep stored readings that are not shown in the current edit form; clear only visible blank fields. */
export function editedMetrics(previous: Weighin['metrics'] | undefined, visible: ReadingKey[], edits: Partial<Record<ReadingKey, number | null>>): Weighin['metrics'] {
  const result: Weighin['metrics'] = { ...previous };
  for (const key of visible) {
    const value = edits[key];
    if (value == null) delete result[key];
    else result[key] = value;
  }
  return result;
}

/** Readings a scale can give (stored in `metrics`). Percentages are of body weight. */
export const READINGS = {
  body_fat_pct: { label: 'Body fat', short: 'BF', unit: '%', max: 75 },
  muscle_pct: { label: 'Muscle mass', short: 'MM', unit: '%', max: 90 },
  body_water_pct: { label: 'Body water', short: 'BW', unit: '%', max: 90 },
  visceral_fat: { label: 'Visceral fat', short: 'VF', unit: '', max: 60 },
  subcutaneous_fat_pct: { label: 'Subcutaneous fat', short: 'SF', unit: '%', max: 70 },
  skeletal_muscle_pct: { label: 'Skeletal muscle', short: 'SM', unit: '%', max: 80 },
  bone_mass_kg: { label: 'Bone mass', short: 'BM', unit: 'mass', max: 15 },
  protein_pct: { label: 'Protein', short: 'PR', unit: '%', max: 40 },
  bmr_kcal: { label: 'BMR', short: 'BMR', unit: 'kcal', max: 6000 },
  metabolic_age: { label: 'Metabolic age', short: 'MA', unit: 'yrs', max: 120 },
  heart_rate: { label: 'Heart rate', short: 'HR', unit: 'bpm', max: 250 },
  fat_arm_l: { label: 'Left arm fat', short: 'LA fat', unit: '%', max: 75 },
  fat_arm_r: { label: 'Right arm fat', short: 'RA fat', unit: '%', max: 75 },
  fat_leg_l: { label: 'Left leg fat', short: 'LL fat', unit: '%', max: 75 },
  fat_leg_r: { label: 'Right leg fat', short: 'RL fat', unit: '%', max: 75 },
  fat_trunk: { label: 'Trunk fat', short: 'TR fat', unit: '%', max: 75 },
  muscle_arm_l: { label: 'Left arm muscle', short: 'LA mus', unit: 'mass', max: 30 },
  muscle_arm_r: { label: 'Right arm muscle', short: 'RA mus', unit: 'mass', max: 30 },
  muscle_leg_l: { label: 'Left leg muscle', short: 'LL mus', unit: 'mass', max: 60 },
  muscle_leg_r: { label: 'Right leg muscle', short: 'RL mus', unit: 'mass', max: 60 },
  muscle_trunk: { label: 'Trunk muscle', short: 'TR mus', unit: 'mass', max: 100 },
} as const;
export type ReadingKey = keyof typeof READINGS;
export const READING_KEYS = Object.keys(READINGS) as ReadingKey[];

/** What can be ticked in settings and shown as chart chips: weight, the readings, and values worked out from them */
export const DERIVED = {
  weight: { label: 'Weight' },
  lean_mass: { label: 'Lean mass' },      // weight × (1 − body fat)
  fat_mass: { label: 'Fat mass' },        // weight × body fat
  bmi: { label: 'BMI' },                  // needs height
} as const;
export type MetricKey = keyof typeof DERIVED | ReadingKey;
export const DEFAULT_METRICS: MetricKey[] = ['weight', 'body_fat_pct', 'muscle_pct', 'lean_mass'];
export const metricLabel = (k: MetricKey) => (k in DERIVED ? DERIVED[k as keyof typeof DERIVED].label : READINGS[k as ReadingKey].label);
export const GROUPS: { title: string; keys: MetricKey[] }[] = [
  { title: 'Basics', keys: ['weight', 'body_fat_pct', 'muscle_pct', 'lean_mass', 'fat_mass', 'bmi'] },
  { title: 'Body composition', keys: ['body_water_pct', 'visceral_fat', 'subcutaneous_fat_pct', 'skeletal_muscle_pct', 'bone_mass_kg', 'protein_pct', 'bmr_kcal', 'metabolic_age'] },
  { title: 'Segmental (arms, legs, trunk)', keys: ['fat_arm_l', 'fat_arm_r', 'fat_leg_l', 'fat_leg_r', 'fat_trunk', 'muscle_arm_l', 'muscle_arm_r', 'muscle_leg_l', 'muscle_leg_r', 'muscle_trunk'] },
  { title: 'Other', keys: ['heart_rate'] },
];
/** Readings that can be typed in for the chosen metrics (derived ones aren't typed) */
export const enterable = (metrics: MetricKey[]) => metrics.filter((k): k is ReadingKey => k in READINGS);

/* ---------------- units ---------------- */
const LB = 2.2046226218;
export const fromKg = (kg: number, u: BodyUnit) => (u === 'kg' ? kg : u === 'lb' ? kg * LB : (kg * LB) / 14);
export const toKgFrom = (v: number, u: BodyUnit) => (u === 'kg' ? v : u === 'lb' ? v / LB : (v * 14) / LB);
export const unitLabel = (u: BodyUnit) => (u === 'lb' ? 'lbs' : u === 'kg' ? 'kg' : 'st');
const r1 = (n: number) => Math.round(n * 10) / 10;
/** Number with one decimal, in the person's number format (dot: 1,200.5 · comma: 1.200,5) */
export function fmtNum(n: number, dp = 1, format: 'dot' | 'comma' = 'dot') {
  const s = Math.abs(n).toFixed(dp);
  const [i, d] = s.split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, format === 'dot' ? ',' : '.');
  return `${n < 0 ? '−' : ''}${grouped}${d ? (format === 'dot' ? '.' : ',') + d : ''}`;
}
export const fmtMass = (kg: number, u: BodyUnit, format: 'dot' | 'comma' = 'dot') => `${fmtNum(fromKg(kg, u), 1, format)} ${unitLabel(u)}`;
export const signed = (n: number, dp = 1, format: 'dot' | 'comma' = 'dot') => `${n > 0 ? '+' : n < 0 ? '' : '±'}${fmtNum(n, dp, format)}`;

/* ---------------- values ---------------- */
/** Value of a metric for one weigh-in, in kg for masses, else the reading. Null when it can't be worked out. */
export function valueOf(w: Pick<Weighin, 'weight_kg' | 'metrics'>, k: MetricKey, heightCm?: number | null): number | null {
  const kg = Number(w.weight_kg);
  const bf = w.metrics.body_fat_pct;
  switch (k) {
    case 'weight': return kg;
    case 'lean_mass': return bf == null ? null : kg * (1 - bf / 100);
    case 'fat_mass': return bf == null ? null : (kg * bf) / 100;
    case 'bmi': return heightCm ? bmi(kg, heightCm) : null;
    default: { const v = w.metrics[k]; return v == null ? null : Number(v); }
  }
}
/** Is this metric a mass (shown in lb/kg and charted on the weight axis)? Percent-of-weight readings chart as mass too. */
export const isMassChart = (k: MetricKey) => ['weight', 'lean_mass', 'fat_mass', 'muscle_pct', 'body_fat_pct', 'bone_mass_kg', 'skeletal_muscle_pct'].includes(k);
/** Charted value: percent-of-weight readings become a mass (like the weight chart), others stay as they are */
export function chartValue(w: Pick<Weighin, 'weight_kg' | 'metrics'>, k: MetricKey, heightCm?: number | null): number | null {
  if (k === 'muscle_pct' || k === 'body_fat_pct' || k === 'skeletal_muscle_pct') {
    const pct = w.metrics[k]; return pct == null ? null : (Number(w.weight_kg) * pct) / 100;
  }
  return valueOf(w, k, heightCm);
}
/** Label for a metric's latest value, e.g. "30.2 %", "244.8 lbs", "12" */
export function fmtMetric(k: MetricKey, v: number, u: BodyUnit, format: 'dot' | 'comma' = 'dot') {
  if (k === 'weight' || k === 'lean_mass' || k === 'fat_mass') return fmtMass(v, u, format);
  if (k === 'bmi') return fmtNum(v, 1, format);
  const r = READINGS[k as ReadingKey];
  if (r.unit === 'mass') return fmtMass(v, u, format);
  if (r.unit === '%') return `${fmtNum(v, 1, format)} %`;
  if (r.unit === 'kcal') return `${fmtNum(v, 0, format)} kcal`;
  return `${fmtNum(v, r.unit === 'bpm' || r.unit === 'yrs' || Number.isInteger(v) ? 0 : 1, format)}${r.unit ? ` ${r.unit}` : ''}`;
}

/* ---------------- BMI ---------------- */
export const bmi = (kg: number, cm: number) => kg / (cm / 100) ** 2;
export function bmiClass(b: number) {
  if (b < 18.5) return 'Underweight';
  if (b < 25) return 'Healthy';
  if (b < 30) return 'Overweight';
  if (b < 35) return 'Obese class I';
  if (b < 40) return 'Obese class II';
  return 'Obese class III';
}

/* ---------------- trend ---------------- */
const DAY = 86_400_000;
/** Exponentially smoothed weight (10% a day, adjusted for gaps), oldest first. Takes weigh-ins in any order. */
export function trend(list: Pick<Weighin, 'measured_at' | 'weight_kg'>[], smoothing = 0.1): { t: number; kg: number; trend: number }[] {
  const pts = [...list].map((w) => ({ t: new Date(w.measured_at).getTime(), kg: Number(w.weight_kg) })).sort((a, b) => a.t - b.t);
  const out: { t: number; kg: number; trend: number }[] = [];
  let prev: { t: number; trend: number } | null = null;
  for (const p of pts) {
    const tr: number = prev ? prev.trend + (1 - (1 - smoothing) ** Math.max((p.t - prev.t) / DAY, 0.05)) * (p.kg - prev.trend) : p.kg;
    out.push({ t: p.t, kg: p.kg, trend: tr });
    prev = { t: p.t, trend: tr };
  }
  return out;
}
/** Trend change per week (kg), from a straight-line fit of the trend over the last `days` days */
export function ratePerWeek(tr: { t: number; trend: number }[], days = 28): number | null {
  if (tr.length < 2) return null;
  const end = tr[tr.length - 1].t;
  const pts = tr.filter((p) => p.t >= end - days * DAY);
  if (pts.length < 2 || pts[pts.length - 1].t - pts[0].t < 3 * DAY) return null;
  const xs = pts.map((p) => (p.t - end) / DAY), ys = pts.map((p) => p.trend);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0), den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return den ? (num / den) * 7 : null;
}
/** Daily calorie surplus (+) or deficit (−) implied by a weekly change: about 7,700 kcal per kg */
export const kcalPerDay = (kgPerWeek: number) => (kgPerWeek * 7700) / 7;
/** When the goal would be reached at the current rate, or null if moving the wrong way or too slowly */
export function goalEta(trendKg: number, goalKg: number, kgPerWeek: number | null, from = new Date()): Date | null {
  const diff = goalKg - trendKg;
  if (Math.abs(diff) < 0.05) return from;
  if (!kgPerWeek || Math.sign(kgPerWeek) !== Math.sign(diff) || Math.abs(kgPerWeek) < 0.01) return null;
  const weeks = diff / kgPerWeek;
  if (weeks > 520) return null;
  return new Date(from.getTime() + weeks * 7 * DAY);
}

/* ---------------- stats ---------------- */
export function extremes(list: Weighin[]) {
  if (!list.length) return null;
  let lo = list[0], hi = list[0];
  for (const w of list) { if (Number(w.weight_kg) < Number(lo.weight_kg)) lo = w; if (Number(w.weight_kg) > Number(hi.weight_kg)) hi = w; }
  return { lowest: lo, highest: hi };
}
/** Trend change over the last N days (kg and %), and per week */
export function changeOver(tr: { t: number; trend: number }[], days: number) {
  if (tr.length < 2) return null;
  const end = tr[tr.length - 1];
  const startT = end.t - days * DAY;
  if (tr[0].t > startT + DAY) return null;  // not enough history
  // Trend at exactly N days ago, read between the weigh-ins either side
  let i = 0;
  while (i < tr.length - 1 && tr[i + 1].t <= startT) i++;
  const a = tr[i], b = tr[Math.min(i + 1, tr.length - 1)];
  const startTrend = b.t === a.t || startT <= a.t ? a.trend : a.trend + ((b.trend - a.trend) * (startT - a.t)) / (b.t - a.t);
  const kg = end.trend - startTrend;
  return { kg, pct: (kg / startTrend) * 100, perWeek: (kg / days) * 7 };
}
export const PERIODS: [label: string, days: number][] = [['Week', 7], ['15 days', 15], ['Month', 30], ['Three months', 91], ['Six months', 182], ['Year', 365]];

const monthKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
/** Change in trend within each calendar month (last trend of the month minus last of the month before) */
export function monthlyChange(tr: { t: number; trend: number }[]): { month: string; kg: number; pct: number }[] {
  const last = new Map<string, number>();
  for (const p of tr) last.set(monthKey(p.t), p.trend);
  const months = [...last.keys()].sort();
  return months.slice(1).map((m, i) => { const a = last.get(months[i])!, b = last.get(m)!; return { month: m, kg: b - a, pct: ((b - a) / a) * 100 }; });
}
export function yearlyChange(tr: { t: number; trend: number }[]): { year: number; kg: number; pct: number }[] {
  const first = new Map<number, number>(), last = new Map<number, number>();
  for (const p of tr) { const y = new Date(p.t).getFullYear(); if (!first.has(y)) first.set(y, p.trend); last.set(y, p.trend); }
  return [...last.keys()].sort().map((y) => { const a = first.get(y)!, b = last.get(y)!; return { year: y, kg: b - a, pct: ((b - a) / a) * 100 }; });
}
/** Weigh-ins grouped by month, newest first, with the month's change */
export function byMonth(list: Weighin[]) {
  const sorted = [...list].sort((a, b) => b.measured_at.localeCompare(a.measured_at));
  const groups: { month: string; items: Weighin[]; change: number | null; pct: number | null }[] = [];
  for (const w of sorted) {
    const k = monthKey(new Date(w.measured_at).getTime());
    let g = groups[groups.length - 1];
    if (!g || g.month !== k) { g = { month: k, items: [], change: null, pct: null }; groups.push(g); }
    g.items.push(w);
  }
  for (let i = 0; i < groups.length; i++) {
    const newest = Number(groups[i].items[0].weight_kg), prevMonth = groups[i + 1]?.items[0];
    const base = prevMonth ? Number(prevMonth.weight_kg) : Number(groups[i].items[groups[i].items.length - 1].weight_kg);
    groups[i].change = newest - base; groups[i].pct = ((newest - base) / base) * 100;
  }
  return groups;
}
/** "1 year, 5 months, 6 days" between the first and last weigh-in */
export function spanText(list: Weighin[]) {
  if (list.length < 2) return '';
  const ts = list.map((w) => new Date(w.measured_at).getTime());
  const a = new Date(Math.min(...ts)), b = new Date(Math.max(...ts));
  let y = b.getFullYear() - a.getFullYear(), m = b.getMonth() - a.getMonth(), d = b.getDate() - a.getDate();
  if (d < 0) { m -= 1; d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
  if (m < 0) { y -= 1; m += 12; }
  const part = (n: number, w: string) => (n ? `${n} ${w}${n === 1 ? '' : 's'}` : '');
  return [part(y, 'year'), part(m, 'month'), part(d, 'day')].filter(Boolean).join(', ') || 'Same day';
}
export const RANGES: [label: string, days: number | null][] = [['1M', 30], ['3M', 91], ['6M', 182], ['1Y', 365], ['All', null]];

/* ---------------- import (Libra, RENPHO and other CSV exports) ---------------- */
export type Imported = { measured_at: string; weight_kg: number; metrics: Partial<Record<ReadingKey, number>> };
const COLS: [RegExp, ReadingKey | 'weight' | 'date' | 'time' | 'fat_free'][] = [
  [/^(date|time of measurement|measured|timestamp|datetime|date ?time)/i, 'date'],
  [/^time$/i, 'time'],
  [/^(body )?weight(?! trend)/i, 'weight'],
  [/^(body ?fat|fat ?%|bf)(?! trend)(?!.*mass)/i, 'body_fat_pct'],
  [/subcutaneous/i, 'subcutaneous_fat_pct'],
  [/visceral/i, 'visceral_fat'],
  [/(body )?water/i, 'body_water_pct'],
  [/skeletal/i, 'skeletal_muscle_pct'],
  [/^muscle( mass)?(?! trend)/i, 'muscle_pct'],
  [/bone/i, 'bone_mass_kg'],
  [/protein/i, 'protein_pct'],
  [/bmr|basal/i, 'bmr_kcal'],
  [/metabolic age|body age/i, 'metabolic_age'],
  [/heart|pulse|bpm/i, 'heart_rate'],
  [/fat.?free/i, 'fat_free'],
];
function splitLine(line: string, sep: string) {
  const out: string[] = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
const n = (s: string | undefined) => { if (s == null) return null; const t = s.replace(/[^\d.,-]/g, '').replace(',', '.'); const v = parseFloat(t); return Number.isFinite(v) ? v : null; };
function parseDate(d: string, time?: string): Date | null {
  const s = `${d}${time ? ` ${time}` : ''}`.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (!m) {
    const us = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[T ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i);
    if (!us) { const t = Date.parse(s); return Number.isNaN(t) ? null : new Date(t); }
    const y = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
    m = [us[0], String(y), us[1], us[2], us[4], us[5], us[6], us[7]] as RegExpMatchArray;
  }
  let h = Number(m[4] ?? 12); const mi = Number(m[5] ?? 0), sec = Number(m[6] ?? 0);
  if (m[7]) { const pm = /pm/i.test(m[7]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
  // An ISO timestamp with a zone (Libra exports UTC) is read as written
  if (/T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) { const t = Date.parse(s); if (!Number.isNaN(t)) return new Date(t); }
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h, mi, sec);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
/** Reads a CSV export from Libra, RENPHO or a spreadsheet. Units come from a "#Units:lb" line or a "(lb)" header. */
export function parseCsv(text: string, fallback: BodyUnit = 'lb'): { rows: Imported[]; skipped: number } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  let unit: BodyUnit = fallback;
  const unitLine = lines.find((l) => /^#?\s*units?\s*[:=]/i.test(l));
  if (unitLine) unit = /kg/i.test(unitLine) ? 'kg' : /st/i.test(unitLine) && !/lb/i.test(unitLine) ? 'st' : 'lb';
  const hi = lines.findIndex((l) => /weight/i.test(l) && /date|time/i.test(l));
  if (hi < 0) return { rows: [], skipped: 0 };
  const header = lines[hi].replace(/^#\s*/, '');
  const sep = [';', ',', '\t'].map((s) => [s, header.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const cols = splitLine(header, sep);
  const map: Partial<Record<string, number>> = {};
  const massUnit: Partial<Record<string, BodyUnit>> = {};
  cols.forEach((c, i) => {
    const hit = COLS.find(([re]) => re.test(c));
    if (hit && map[hit[1]] === undefined) {
      map[hit[1]] = i;
      if (/\((kg|kgs)\)/i.test(c)) massUnit[hit[1]] = 'kg'; else if (/\((lb|lbs)\)/i.test(c)) massUnit[hit[1]] = 'lb';
    }
  });
  if (map.date === undefined || map.weight === undefined) return { rows: [], skipped: 0 };
  const rows: Imported[] = []; let skipped = 0;
  for (const line of lines.slice(hi + 1)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const f = splitLine(line, sep);
    const when = parseDate(f[map.date!], map.time !== undefined ? f[map.time] : undefined);
    const wv = n(f[map.weight!]);
    if (!when || wv == null || wv <= 0) { skipped++; continue; }
    const kg = toKgFrom(wv, massUnit.weight ?? unit);
    if (kg < 20 || kg > 400) { skipped++; continue; }
    const metrics: Partial<Record<ReadingKey, number>> = {};
    for (const k of READING_KEYS) {
      if (map[k] === undefined) continue;
      let v = n(f[map[k]!]);
      if (v == null || v <= 0) continue;
      if (k === 'bone_mass_kg') v = toKgFrom(v, massUnit[k] ?? unit);
      else if (k === 'muscle_pct' && (massUnit[k] || v > 95)) v = (toKgFrom(v, massUnit[k] ?? unit) / kg) * 100;  // "Muscle Mass(lb)" → %
      if (v <= READINGS[k].max * (READINGS[k].unit === 'mass' ? 2.3 : 1)) metrics[k] = r1(v);
    }
    // Only fat-free weight given: work out body fat
    if (metrics.body_fat_pct == null && map.fat_free !== undefined) {
      const ff = n(f[map.fat_free]); if (ff) { const pct = (1 - toKgFrom(ff, massUnit.fat_free ?? unit) / kg) * 100; if (pct > 2 && pct < 75) metrics.body_fat_pct = r1(pct); }
    }
    rows.push({ measured_at: when.toISOString(), weight_kg: Math.round(kg * 100) / 100, metrics });
  }
  return { rows, skipped };
}

/* ---------------- Health Connect (Android) ---------------- */
/** Readings as Health Connect stores them (each is its own record with a time) */
export type HealthReadings = {
  weight: { time: string; kg: number; origin?: string }[];
  bodyFat: { time: string; pct: number }[];
  leanMass: { time: string; kg: number }[];
  boneMass: { time: string; kg: number }[];
  bodyWater: { time: string; kg: number }[];
  bmr: { time: string; kcal: number }[];
};
/** Pairs each weigh-in with the readings taken at the same moment (within 10 minutes), the way a smart scale saves them */
export function mergeHealth(h: HealthReadings, existing: Pick<Weighin, 'measured_at'>[] = []): Imported[] {
  const near = <T extends { time: string }>(list: T[], t: number) => {
    let best: T | null = null, gap = 10 * 60_000;
    for (const x of list) { const d = Math.abs(new Date(x.time).getTime() - t); if (d <= gap) { gap = d; best = x; } }
    return best;
  };
  const have = existing.map((w) => new Date(w.measured_at).getTime());
  const out: Imported[] = [];
  for (const w of h.weight) {
    const t = new Date(w.time).getTime();
    if (!Number.isFinite(t) || w.kg < 20 || w.kg > 400) continue;
    if (have.some((x) => Math.abs(x - t) < 5 * 60_000)) continue;  // already have this weigh-in (typed, imported or synced)
    const m: Partial<Record<ReadingKey, number>> = {};
    const bf = near(h.bodyFat, t), lean = near(h.leanMass, t), bone = near(h.boneMass, t), water = near(h.bodyWater, t), bmrR = near(h.bmr, t);
    if (bf && bf.pct > 2 && bf.pct < 75) m.body_fat_pct = r1(bf.pct);
    else if (lean && lean.kg < w.kg) { const pct = (1 - lean.kg / w.kg) * 100; if (pct > 2 && pct < 75) m.body_fat_pct = r1(pct); }
    if (bone && bone.kg > 0 && bone.kg < 15) m.bone_mass_kg = r1(bone.kg);
    if (water && water.kg > 0 && water.kg < w.kg) m.body_water_pct = r1((water.kg / w.kg) * 100);
    if (bmrR && bmrR.kcal > 300 && bmrR.kcal < 6000) m.bmr_kcal = Math.round(bmrR.kcal);
    out.push({ measured_at: new Date(t).toISOString(), weight_kg: Math.round(w.kg * 100) / 100, metrics: m });
    have.push(t);
  }
  return out;
}
