// The shared library's online part: exercises added from trainers' suggestions and extra search names, plus sending a
// suggestion for review (the coach-exercise-submit function decides whether it's new, another name, or needs more detail).
import { callFn } from '@/lib/fn';
import { builtIn, CATEGORIES, EQUIPMENT, MUSCLES, setLibraryExtras, similarTo } from '@/lib/library';
import { sb } from '@/lib/supabase';

/** Loads approved additions and extra names into the library. Safe to call again (e.g. after a suggestion is accepted). */
export async function loadLibraryExtras() {
  const [rows, names] = await Promise.all([
    sb.from('coach_library_extra').select('data').limit(2000),
    sb.from('coach_library_aliases').select('ref, alias').limit(5000),
  ]);
  if (rows.error || names.error) return;
  setLibraryExtras(rows.data.map((r) => r.data as unknown[]), names.data);
}

export type Suggested = { name: string; aliases?: string[]; category: string; gear: string[]; main: string[]; other: string[]; description: string; video?: string };
export type Review = { outcome: 'alias' | 'added' | 'already_listed' | 'needs_detail' | 'rejected'; ref?: string; name?: string; reason: string };

/** Sends a suggestion for review, with the library exercises most like it to compare against */
export async function suggestExercise(s: Suggested): Promise<Review> {
  const all = builtIn();
  const candidates = similarTo({ name: s.name, gear: s.gear, main: s.main }, all).map((e) => ({
    ref: e.ref, name: e.name, aliases: e.aliases ?? [], category: e.category, pattern: e.pattern ?? '', gear: e.gear ?? [], main: e.primary,
    setup: e.how?.setup ?? '', move: e.how?.move ?? '',
  }));
  const patterns = [...new Set(all.map((e) => e.pattern).filter((x): x is string => !!x))];
  const r = await callFn<Review>('coach-exercise-submit', { exercise: s, candidates, lists: { categories: CATEGORIES, gear: EQUIPMENT, muscles: MUSCLES, patterns } });
  if (r.outcome === 'added' || r.outcome === 'alias') await loadLibraryExtras();
  return r;
}

/** What to tell the trainer */
export function reviewText(r: Review): string {
  switch (r.outcome) {
    case 'alias': return `Already in the library as “${r.name}”. Your name for it now finds it in search too.`;
    case 'already_listed': return `Already in the library as “${r.name}”.`;
    case 'added': return `Added to the Dragonfly library as “${r.name}”. ${r.reason}`;
    case 'needs_detail': return `Not added yet: ${r.reason}`;
    default: return `Not added: ${r.reason}`;
  }
}
