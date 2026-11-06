// The shared library's online part: exercises added from trainers' suggestions and extra search names, plus sending a
// suggestion for review (the AI decides straight away; a person only sees escalations), reports and hidden exercises.
import { useEffect, useState } from 'react';
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
export type Review = { id: string | null; outcome: 'alias' | 'added' | 'already_listed' | 'needs_detail' | 'rejected'; ref?: string; name?: string; reason: string };

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

/** Asks a person to look at a review the AI got wrong or that can't be fixed by editing */
export async function escalateSuggestion(id: string, note: string) {
  const { error } = await sb.rpc('coach_escalate_submission', { sid: id, note });
  if (error) throw error;
}

/** What to tell the trainer */
export function reviewText(r: Review): string {
  switch (r.outcome) {
    case 'alias': return `It's already in the library as “${r.name}”. Your name for it now finds it in search too.`;
    case 'added': return `Added to the Dragonfly library as “${r.name}”.`;
    case 'already_listed': return r.reason.startsWith('An exercise') ? r.reason : `Already in the library as “${r.name}”.`;
    case 'needs_detail': return `Not added yet: ${r.reason}`;
    default: return `Not added: ${r.reason}`;
  }
}

/** An admin's view of what waits for review */
export type Pending = { id: string; created_at: string; exercise: Suggested; ai_decision: string; reason: string | null; match_ref: string | null;
  outcome: string; escalated_from: string | null; escalation_note: string | null;
  proposal: { kind: 'alias'; ref: string; names: string[] } | { kind: 'add'; ref: string; row: unknown[] } | null };
export type Report = { id: string; created_at: string; ref: string; name: string; kind: ReportKind; note: string | null; status: string };
export type ReportKind = 'redundant' | 'wrong_video' | 'unclear' | 'unsafe' | 'other';
export const REPORT_KINDS: [ReportKind, string][] = [['redundant', 'Same as another exercise'], ['wrong_video', 'Wrong or bad video'], ['unclear', 'Unclear instructions'], ['unsafe', 'Unsafe or poor form'], ['other', 'Something else']];

export async function reportExercise(ref: string, name: string, kind: ReportKind, note: string) {
  const { error } = await sb.from('coach_exercise_reports').insert({ ref, name, kind, note: note.trim() || null });
  if (error) throw error;
}

/** Exercises this person has hidden from their lists */
export async function loadHidden(): Promise<Set<string>> {
  const { data } = await sb.from('coach_hidden_exercises').select('ref');
  return new Set((data ?? []).map((r) => r.ref as string));
}
export async function setHidden(ref: string, hide: boolean) {
  const { error } = hide ? await sb.from('coach_hidden_exercises').insert({ ref }) : await sb.from('coach_hidden_exercises').delete().eq('ref', ref);
  if (error) throw error;
}

// One shared copy of the hidden list, so the picker, the info sheet and the swap sheet agree
let hiddenNow: Set<string> = new Set();
let hiddenLoaded = false;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((f) => f());
/** The exercises this person hid, and a way to hide or show one again */
export function useHidden(): [Set<string>, (ref: string, hide: boolean) => Promise<void>] {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    if (!hiddenLoaded) { hiddenLoaded = true; loadHidden().then((s) => { hiddenNow = s; tell(); }).catch(() => { hiddenLoaded = false; }); }
    return () => { listeners.delete(f); };
  }, []);
  const toggle = async (ref: string, hide: boolean) => {
    const before = hiddenNow;
    hiddenNow = new Set(before); if (hide) hiddenNow.add(ref); else hiddenNow.delete(ref);
    tell();
    try { await setHidden(ref, hide); } catch (e) { hiddenNow = before; tell(); throw e; }
  };
  return [hiddenNow, toggle];
}
