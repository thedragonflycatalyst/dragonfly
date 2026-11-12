// Saves unfinished workouts that have sat 4 hours without activity (owner 2026-11-12). Runs when the app opens, comes
// back to the foreground, and every few minutes while it's open. The same safeguards as tapping Save: the assignment id
// is written to the draft before anything is sent, so a retry after a lost connection never makes a second workout or
// log. An open workout screen hears about it (onAutoSubmitted) and moves to the finished workout.
import * as Crypto from 'expo-crypto';
import { AUTO_NOTE, autoDurationSeconds, dueForAutoSubmit } from '@/lib/auto-submit';
import { dayKey } from '@/lib/dates';
import { clearMatchingDraft, discoverWorkoutDrafts, workoutDraftSlot, writeDraftPatch } from '@/lib/draft-integrity';
import { doneOnly, type Draft } from '@/lib/session';
import { storage } from '@/lib/storage';
import { sb } from '@/lib/supabase';

type Listener = (key: string, assignmentId: string) => void;
const listeners = new Set<Listener>();
/** An open workout screen listens so it can close itself when its workout was saved on its own */
export function onAutoSubmitted(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }

let running = false;

/** Saves one draft. Returns the assignment id, or null if it can't be saved yet (it stays for next time). */
async function submit(d: Draft, userId: string): Promise<string | null> {
  const aid = d.params.aid;
  let assignmentId = aid ?? d.pendingAssignmentId ?? null;
  let source: 'app' | 'trainer' = 'app';
  if (aid) {
    const { data: a, error } = await sb.from('coach_assignments').select('id, trainer_id, status').eq('id', aid).maybeSingle();
    if (error) return null;
    if (!a) return null;                                  // gone (deleted by the trainer): leave it for the person to discard
    source = a.trainer_id === userId ? 'trainer' : 'app';
  } else {
    // A trainer's own workout run for a client: needs the client and the workout to make the assignment
    source = 'trainer';
    if (!d.client_id || !d.params.workout) return null;
    if (!assignmentId) {
      assignmentId = Crypto.randomUUID();
      if (!writeDraftPatch(storage, workoutDraftSlot(d.key), d.key, { pendingAssignmentId: assignmentId })) return null;
    }
    const { data: existing } = await sb.from('coach_assignments').select('id').eq('id', assignmentId).maybeSingle();
    if (!existing) {
      const { data: w } = await sb.from('coach_workouts').select('id, name, blocks').eq('id', d.params.workout).maybeSingle();
      if (!w) return null;
      const { error } = await sb.from('coach_assignments').insert({
        id: assignmentId, trainer_id: userId, client_id: d.client_id, workout_id: w.id, scheduled_on: dayKey(new Date(d.started)), title: d.title, snapshot: w.blocks,
      });
      if (error && error.code !== '23505') return null;
    }
  }
  if (!assignmentId) return null;
  const { error } = await sb.from('coach_logs').insert({
    assignment_id: assignmentId, client_id: d.client_id, user_id: userId, duration_seconds: autoDurationSeconds(d),
    entries: doneOnly(d.log), timer_results: d.timerResults ?? [], note: AUTO_NOTE, source,
  });
  if (error && error.code !== '23505') return null;     // 23505: already saved (another device, or a lost reply)
  return assignmentId;
}

/** Looks for workouts idle 4+ hours and saves them. Returns how many were saved. */
export async function autoSubmitIdleWorkouts(userId: string | null | undefined, now = Date.now()): Promise<number> {
  if (!userId || running) return 0;
  running = true;
  let n = 0;
  try {
    let drafts: Draft[] = [];
    try { drafts = discoverWorkoutDrafts(storage); } catch { return 0; }
    for (const d of drafts) {
      if (!dueForAutoSubmit(d, now)) continue;
      try {
        const id = await submit(d, userId);
        if (!id) continue;
        try { clearMatchingDraft(storage, workoutDraftSlot(d.key), d.key); } catch { /* cleared next run */ }
        try { if (parseLegacy(d.key)) storage.removeItem('dragonfly.session'); } catch { /* nothing */ }
        n++;
        for (const fn of listeners) fn(d.key, id);
      } catch { /* offline or refused: tried again next time */ }
    }
  } finally { running = false; }
  return n;
}

/** The one pre-v2 draft slot, if it holds this workout */
function parseLegacy(key: string) {
  try { return (JSON.parse(storage.getItem('dragonfly.session') ?? 'null') as { key?: string } | null)?.key === key; } catch { return false; }
}
