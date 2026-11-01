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
  coach_clients_trainer_email: 'You already have a client with that email.',
  'linked to an account': 'This client has already set up their account, so their email can’t be changed here.',
  rate_limited: 'Too many emails were sent just now. Wait a minute and try again.',
  own_email: 'That’s your own email. Use your client’s email address.',
  client_archived: 'Restore this client before sending them an email.',
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

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
