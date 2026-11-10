// Shapes of the coach_ tables (supabase/migrations/*_coach_core.sql).

export type Units = 'imperial' | 'metric';
export type Trainer = {
  user_id: string; display_name: string; business_name: string | null; bio: string | null; timezone: string;
  units: Units; auto_health_form: boolean; auto_freeze_days: number; checkin_every_days?: number;
  client_perms?: Partial<import('./prefs').ClientPerms>; cancel_hours?: number; brand_color?: string | null; logo?: string | null; welcome?: string | null;
  unit_prefs?: Partial<import('./prefs').UnitPrefs>; notify?: Record<string, unknown>;
};

export type ClientStatus = 'lead' | 'invited' | 'active' | 'frozen' | 'archived';
export type Sex = 'male' | 'female' | 'other';
export type Client = {
  id: string; trainer_id: string; user_id: string | null; name: string; first_name: string; last_name: string;
  email: string; phone: string | null; sex: Sex | null; date_of_birth: string | null; height_cm: number | null;
  status: ClientStatus; goals: string | null; interests: string[]; source: string | null;
  frequency_tier?: import('./client-pool').Tier; short_notice_ok?: boolean; short_notice_at?: string | null; client_of?: 'private' | 'ca' | 'other';
  started_on: string | null; frozen_at: string | null; frozen_reason: 'manual' | 'inactive' | null;
  last_session_at: string | null; onboarded_at: string | null; created_at: string; updated_at: string;
  contact_via?: 'app' | 'sms' | 'whatsapp';
} & import('./client-away').AwayFields;
export const STATUS_LABEL: Record<ClientStatus, string> = { lead: 'In client pool', invited: 'Invited', active: 'Active', frozen: 'Frozen', archived: 'Archived' };

export type Group = { id: string; trainer_id: string; name: string; created_at: string };
export type Note = { id: string; client_id: string; body: string; pinned: boolean; created_at: string; updated_at: string };
export type Measurement = {
  id: string; client_id: string; trainer_id: string; measured_on: string; weight_kg: number | null; body_fat_pct: number | null;
  neck_cm: number | null; chest_cm: number | null; waist_cm: number | null; hips_cm: number | null; arm_cm: number | null;
  thigh_cm: number | null; calf_cm: number | null; note: string | null; entered_by: string | null; created_at: string;
};
export const BODY_PARTS = [['neck_cm', 'Neck'], ['chest_cm', 'Chest'], ['waist_cm', 'Waist'], ['hips_cm', 'Hips'],
  ['arm_cm', 'Arm'], ['thigh_cm', 'Thigh'], ['calf_cm', 'Calf']] as const;
export type Pose = 'front' | 'side' | 'back' | 'other';
export type Photo = { id: string; client_id: string; trainer_id: string; taken_on: string; pose: Pose; path: string; note: string | null; uploaded_by: string | null; created_at: string };
export type ClientFile = { id: string; client_id: string; trainer_id: string; name: string; path: string; size_bytes: number | null; mime: string | null; uploaded_by: string | null; created_at: string };
export type QuestionType = 'yesno' | 'text' | 'longtext' | 'number' | 'date' | 'choice' | 'scale' | 'signature';
export type Question = { id: string; type: QuestionType; label: string; required?: boolean; options?: string[] };
export type Form = { id: string; trainer_id: string; kind: 'custom' | 'health'; title: string; description: string | null; questions: Question[]; archived: boolean };
export type FormRequest = {
  id: string; form_id: string | null; client_id: string; trainer_id: string; kind: 'custom' | 'health'; title: string;
  questions: Question[]; answers: Record<string, string>; status: 'pending' | 'completed'; flagged: boolean;
  requested_at: string; completed_at: string | null;
};
export type Habit = { id: string; client_id: string; trainer_id: string; title: string; details: string | null; days_per_week: number; active: boolean; created_at: string; library_id?: string | null; icon?: string | null; color?: string | null; once?: boolean; auto_metric?: 'steps' | 'sleep_hours' | 'water_ml' | 'active_kcal' | null; auto_target?: number | null };

export const INTERESTS = ['Weight loss', 'Strength', 'Muscle gain', 'Running', 'Endurance', 'Mobility and flexibility',
  'TRX', 'Sports performance', 'Nutrition', 'Injury recovery', 'Healthy habits', 'Stress relief', 'Group training'];

export type Metric = 'reps' | 'time' | 'distance';
export type Exercise = {
  id: string; trainer_id: string; name: string; instructions: string | null; video_url: string | null;
  equipment: string[]; muscles: string[]; tags: string[]; default_metric: Metric; archived: boolean;
};

/** Timer spec a timed block hands to Lapis: rounds of work/rest in seconds. */
export type TimerSpec = { rounds: number; work: number; rest: number; label?: string; source?: { app: 'lapis'; id: string; snapshot: Record<string, unknown> } };

/** What a block points at: a built-in library exercise or one of the trainer's own (copied in so it still shows if edited later) */
export type ExerciseRef = { src: 'lib' | 'my'; id: string; name: string; img?: string | null; video?: string | null };
/** How a set is measured */
export type SetMetric = 'reps' | 'time' | 'distance';
/** One planned set. Text fields allow ranges like "8-10" or "RPE 8". rest/time are seconds. */
export type SetSpec = { weight?: string; reps?: string; tempo?: string; rest?: number; time?: number; distance?: string };

export type WorkoutBlock =
  /** sides: log left and right separately (unset: worked out from the name, e.g. "Single arm cable curl") */
  | { id: string; kind: 'exercise'; ex: ExerciseRef; metric: SetMetric; sets: SetSpec[]; note?: string; group?: string | null; sides?: boolean }
  | { id: string; kind: 'timed'; name: string; exercise_ids: string[]; timer: TimerSpec; note?: string }
  | { id: string; kind: 'note'; text: string };
export type ExerciseBlock = Extract<WorkoutBlock, { kind: 'exercise' }>;

export type Workout = {
  id: string; trainer_id: string; name: string; description: string | null; blocks: WorkoutBlock[]; archived: boolean;
  folder_id: string | null; cover: string | null; last_used_at: string | null; created_at: string; updated_at: string;
};
export type Folder = { id: string; trainer_id: string; name: string };
export type ProgramItemKind = 'workout' | 'measurements' | 'photo' | 'note';
/** One thing on a program day. Older programs have workout items without `kind`. */
export type ProgramDay = { week: number; day: number; kind?: ProgramItemKind; workout_id?: string; title?: string; details?: string; time?: 'am' | 'pm' };
export type Program = { id: string; trainer_id: string; name: string; description: string | null; weeks: number; schedule: ProgramDay[]; archived: boolean; folder_id: string | null; cover: string | null; updated_at: string; am_time?: string; pm_time?: string; created_at?: string };
export type MyExercise = {
  id: string; trainer_id: string; name: string; instructions: string | null; video_url: string | null;
  equipment: string[]; muscles: string[]; tags: string[]; default_metric: SetMetric; archived: boolean;
  category: string; secondary_muscles: string[]; image_path: string | null; alternatives: string[];
  gallery?: GalleryItem[];
};
/** A still on an exercise (hand position, stance…): a coach-media storage path or a web address, with a short caption */
export type GalleryItem = { path?: string; url?: string; caption: string };

export type Assignment = {
  id: string; trainer_id: string; client_id: string; workout_id: string | null; program_id: string | null;
  scheduled_on: string; title: string; snapshot: WorkoutBlock[]; trainer_note: string | null;
  status: 'scheduled' | 'done' | 'skipped'; completed_at: string | null;
};

/** What was actually done in one set (weight in the trainer's display unit, recorded in `unit`).
 * Two-sided exercises use reps_l/reps_r (or time_l/time_r) instead of reps/time. rest: seconds rested after it. */
export type SetLog = {
  weight?: number | null; reps?: number | null; time?: number | null; distance?: string | null; done: boolean;
  reps_l?: number | null; reps_r?: number | null; time_l?: number | null; time_r?: number | null; rest?: number | null;
};
/** One exercise in a logged workout. sides: logged left/right. note: the trainer's or client's note for this exercise. */
export type LogEntry = { block_id: string; ex?: ExerciseRef; sets: SetLog[]; unit?: 'lb' | 'kg'; swapped_from?: string; swapped_from_ref?: string; sides?: boolean; note?: string; settings?: Record<string, string> };
export type LapisTimerResult = {
  block_id: string; timer_id: string; name: string;
  planned_seconds: number; actual_seconds: number; completed_at: string;
};
export type WorkoutLog = {
  id: string; assignment_id: string | null; client_id: string; user_id: string; performed_at: string;
  duration_seconds: number | null; entries: LogEntry[]; timer_results?: LapisTimerResult[]; rpe: number | null; note: string | null; source: 'app' | 'lapis' | 'trainer';
};

export type Team = { id: string; owner_id: string; name: string };
export type TeamMember = { id: string; team_id: string; trainer_id: string | null; email: string; display_name: string; role: 'owner' | 'trainer'; status: 'invited' | 'active' | 'removed'; created_at: string; perms?: { financials?: boolean; packages?: boolean; events?: boolean } };

export type Person = { user_id: string; username: string; relation: 'client' | 'trainer' };

const FRIENDLY: Record<string, string> = {
  coach_clients_trainer_email: 'You already have a client with that email.',
  'linked to an account': 'This client has already set up their account, so their email can’t be changed here.',
  rate_limited: 'Too many emails were sent just now. Wait a minute and try again.',
  form_incomplete: 'Please answer every required question.',
  form_already_submitted: 'This form was already submitted.',
  coach_groups_trainer_id_name_key: 'You already have a group with that name.',
  'path does not match': 'That file couldn’t be saved to this client.',
  workout_already_done: 'That workout is already logged.',
  coach_workout_folders_trainer_id_name_key: 'You already have a folder with that name.',
  coach_nutrition_folders_trainer_id_name_key: 'You already have a folder with that name.',
  view_only: 'You’re viewing this trainer’s account. Switch on emergency editing to make changes.',
  already_on_a_team: 'You’re already on a team.',
  coach_team_members_email: 'That trainer is already on your team.',
  not_your_team_member: 'That trainer isn’t on your team.',
  member_removed: 'That trainer was removed from your team. Add them again first.',
  coach_logs_one_per_assignment: 'This workout was already logged.',
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
  // Record-keeping rules (payments are kept 7 years; refunds and voids need a reason): their own wording is already plain
  if (/Financial records are kept|paid payment's amount|Give a reason for marking/i.test(m)) return m.replace(/^.*?(Financial records|A paid payment|Give a reason)/, '$1');
  if (/23514/.test(m)) return 'Give a reason first.';
  if (/row-level security|permission denied|42501/i.test(m)) return 'You don’t have access to that.';
  if (/duplicate key|already exists/i.test(m)) return 'That’s already done.';
  if (/Network request failed|Failed to fetch/i.test(m)) return 'Can’t reach the server. Check your connection and try again.';
  return m || 'Something went wrong. Try again.';
}

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
