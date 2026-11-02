// Two-sided (unilateral) exercises: log the left and right side separately so a weaker side shows up clearly.
import type { SetLog } from './model';

const TWO_SIDED = /\b(single[- ]?(arm|leg|hand|side)|one[- ]?(arm|leg|hand)(ed)?|unilateral|each (side|arm|leg)|per (side|arm|leg)|split squats?|bulgarian|step[- ]?ups?|pistol|side planks?|suitcase|offset|copenhagen)\b|\b(l\/r|r\/l)\b/i;

/** Whether an exercise is usually done one side at a time ("Single arm cable curl", "Bulgarian split squat") */
export const isTwoSided = (name: string | undefined | null) => !!name && TWO_SIDED.test(name);

/** The trainer's choice for the block, else a guess from the name */
export const usesSides = (sides: boolean | undefined, name: string | undefined | null) => sides ?? isTwoSided(name);

/** Which side came up short in a set, and by how much (null when even or not filled in) */
export function weakSide(l: number | null | undefined, r: number | null | undefined): { side: 'L' | 'R'; by: number } | null {
  if (l == null || r == null || l === r) return null;
  return l < r ? { side: 'L', by: Math.round((r - l) * 100) / 100 } : { side: 'R', by: Math.round((l - r) * 100) / 100 };
}

/** Reps for volume: both sides added together on two-sided sets */
export const repsOf = (s: SetLog) => (s.reps_l != null || s.reps_r != null ? (s.reps_l ?? 0) + (s.reps_r ?? 0) : s.reps ?? 0);

/** "10 R · 8 L" for a two-sided set, or the plain number */
export function sidesText(l: number | null | undefined, r: number | null | undefined, fmt: (n: number) => string = String) {
  if (l == null && r == null) return '';
  return `${r == null ? '–' : fmt(r)} R · ${l == null ? '–' : fmt(l)} L`;
}
