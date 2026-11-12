// Unfinished workouts save themselves after 4 hours without activity (owner 2026-11-12). Pure rules here; the runner is
// features/auto-submit.ts. Only what was actually done is saved (completed sets and finished timers); a workout with
// nothing done stays in Unfinished workouts for the person to resume or discard.
import { doneOnly, type Draft } from './session';

export const AUTO_SUBMIT_AFTER_MS = 4 * 3_600_000;
export const AUTO_NOTE = 'Saved automatically after 4 hours without activity.';

/** The last moment the workout was touched (older drafts only know when it started) */
export const lastActivity = (d: Draft) => Math.max(d.started, d.touched ?? 0);

/** Has something worth saving */
export const hasProgress = (d: Draft) => doneOnly(d.log).length > 0 || (d.timerResults?.length ?? 0) > 0;

/** Ready to save on its own: 4 hours (or more) without activity, with something done */
export const dueForAutoSubmit = (d: Draft, now: number) => now - lastActivity(d) >= AUTO_SUBMIT_AFTER_MS && hasProgress(d);

/** Workout length: from the start to the last activity (not the hours it sat idle), capped at a day */
export const autoDurationSeconds = (d: Draft) => Math.min(86_400, Math.max(0, Math.round((lastActivity(d) - d.started) / 1000)));
