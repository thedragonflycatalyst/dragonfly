// Shapes of the coach_ tables (supabase/migrations/*_coach_core.sql).

export type Trainer = { user_id: string; display_name: string; business_name: string | null; bio: string | null; timezone: string };

export type ClientStatus = 'invited' | 'active' | 'paused' | 'archived';
export type Client = {
  id: string; trainer_id: string; user_id: string | null; name: string; email: string | null;
  status: ClientStatus; goals: string | null; started_on: string | null; created_at: string;
};

export type Metric = 'reps' | 'time' | 'distance';
export type Exercise = {
  id: string; trainer_id: string; name: string; instructions: string | null; video_url: string | null;
  equipment: string[]; muscles: string[]; tags: string[]; default_metric: Metric; archived: boolean;
};

/** Timer spec a timed block hands to Lapis: rounds of work/rest in seconds. */
export type TimerSpec = { rounds: number; work: number; rest: number; label?: string };

export type WorkoutBlock =
  | { id: string; kind: 'strength'; exercise_id: string | null; name?: string; sets: number; reps: string; load?: string; rest?: number; note?: string; group?: string }
  | { id: string; kind: 'timed'; name: string; exercise_ids: string[]; timer: TimerSpec; note?: string }
  | { id: string; kind: 'note'; text: string };

export type Workout = { id: string; trainer_id: string; name: string; description: string | null; blocks: WorkoutBlock[]; archived: boolean; updated_at: string };

export type Assignment = {
  id: string; trainer_id: string; client_id: string; workout_id: string | null; program_id: string | null;
  scheduled_on: string; title: string; snapshot: WorkoutBlock[]; trainer_note: string | null;
  status: 'scheduled' | 'done' | 'skipped'; completed_at: string | null;
};

export type SetLog = { reps?: number; load?: number; unit?: 'kg' | 'lb'; seconds?: number; done: boolean };
export type LogEntry = { block_id: string; exercise_id?: string | null; sets: SetLog[] };
export type WorkoutLog = {
  id: string; assignment_id: string | null; client_id: string; user_id: string; performed_at: string;
  duration_seconds: number | null; entries: LogEntry[]; rpe: number | null; note: string | null; source: 'app' | 'lapis' | 'trainer';
};

export type Person = { user_id: string; username: string; relation: 'client' | 'trainer' };

const FRIENDLY: Record<string, string> = {
  'invite code is invalid': 'That invite code is invalid or has expired. Ask your trainer for a new one.',
  'already this trainer': 'You’re already this trainer’s client.',
  'own client': 'You can’t be your own client.',
  'already used by another': 'This invite was already used by another account. Ask your trainer for a new one.',
  dragonfly_username_taken: 'That username is taken. Try another.',
  dragonfly_username_invalid: 'Usernames can’t have spaces. Use 3–30 letters, numbers, dots, dashes or underscores.',
  invalid_credentials: 'That username or password didn’t match.',
  email_already_registered: 'That email already has a Dragonfly account. Tap “I have an account” and sign in with it.',
};

export function errText(err: unknown): string {
  const m = (err as { message?: string })?.message || String(err || '');
  for (const k of Object.keys(FRIENDLY)) if (m.includes(k)) return FRIENDLY[k];
  if (/Invalid login credentials/i.test(m)) return FRIENDLY.invalid_credentials;
  if (/Email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the code.';
  if (/row-level security|permission denied|42501/i.test(m)) return 'You don’t have access to that.';
  if (/duplicate key|already exists/i.test(m)) return 'That’s already done.';
  if (/Network request failed|Failed to fetch/i.test(m)) return 'Can’t reach the server. Check your connection and try again.';
  return m || 'Something went wrong. Try again.';
}

/** Pulls an invite code out of whatever the client pasted: the code itself or the whole link. */
export function parseInviteCode(input: string): string | null {
  const s = input.trim();
  // Codes are 8 characters, 0-9 and A-F (made by coach_create_invite)
  const fromLink = s.match(/[?&]code=([A-Fa-f0-9]{8})\b/);
  const raw = fromLink ? fromLink[1] : s.replace(/[\s-]/g, '');
  return /^[A-Fa-f0-9]{8}$/.test(raw) ? raw.toUpperCase() : null;
}
