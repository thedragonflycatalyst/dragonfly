// Everything is stored metric (kg, cm); shown in the trainer's chosen units.
export type Units = 'imperial' | 'metric';

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;
const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inches: number) => inches * CM_PER_IN;

export function cmToFtIn(cm: number): { ft: number; in: number } {
  let ft = Math.floor(cmToIn(cm) / 12);
  let inch = round(cmToIn(cm) - ft * 12, 0);
  if (inch === 12) { ft += 1; inch = 0; }
  return { ft, in: inch };
}
export const ftInToCm = (ft: number, inches: number) => inToCm(ft * 12 + inches);

export const weightUnit = (u: Units) => (u === 'imperial' ? 'lb' : 'kg');
export const lengthUnit = (u: Units) => (u === 'imperial' ? 'in' : 'cm');

/** Stored kg → number in the display unit */
export const showWeight = (kg: number, u: Units) => round(u === 'imperial' ? kgToLb(kg) : kg);
/** Stored cm → number in the display unit */
export const showLength = (cm: number, u: Units) => round(u === 'imperial' ? cmToIn(cm) : cm);
/** Typed number in the display unit → stored kg / cm (null when blank or not a number) */
export const toKg = (typed: string, u: Units) => { const n = num(typed); return n === null ? null : round(u === 'imperial' ? lbToKg(n) : n, 2); };
export const toCm = (typed: string, u: Units) => { const n = num(typed); return n === null ? null : round(u === 'imperial' ? inToCm(n) : n, 1); };

export const fmtWeight = (kg: number | null | undefined, u: Units) => (kg == null ? '' : `${showWeight(Number(kg), u)} ${weightUnit(u)}`);
export const fmtLength = (cm: number | null | undefined, u: Units) => (cm == null ? '' : `${showLength(Number(cm), u)} ${lengthUnit(u)}`);
export function fmtHeight(cm: number | null | undefined, u: Units) {
  if (cm == null) return '';
  if (u === 'metric') return `${round(Number(cm), 0)} cm`;
  const { ft, in: inch } = cmToFtIn(Number(cm));
  return `${ft} ft ${inch} in`;
}

/** Parses a typed number, accepting a comma as the decimal mark. */
export function num(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim().replace(',', '.');
  if (!t || !/^-?\d*\.?\d+$/.test(t)) return null;
  return Number(t);
}

/** Whole years between a YYYY-MM-DD birth date and today */
export function age(dob: string | null | undefined, today = new Date()): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [y, m, d] = dob.split('-').map(Number);
  let a = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) a -= 1;
  return a;
}
