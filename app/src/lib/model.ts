// Shapes of the coach_ tables (supabase/migrations/*_coach_core.sql).

export type Units = 'imperial' | 'metric';
export type Trainer = {
  user_id: string; display_name: string; business_name: string | null; bio: string | null; timezone: string;
  units: Units; auto_health_form: boolean; auto_freeze_days: number;
};

export type ClientStatus = 'lead' | 'invited' | 'active' | 'frozen' | 'archived';
export type Sex = 'male' | 'female' | 'other';
export type Client = {
  id: string; trainer_id: string; user_id: string | null; name: string; first_name: string; last_name: string;
  email: string; phone: string | null; sex: Sex | null; date_of_birth: string | null; height_cm: number | null;
  status: ClientStatus; goals: string | null; interests: string[]; source: string | null;
  started_on: string | null; frozen_at: string | null; frozen_reason: 'manual' | 'inactive' | null;
  last_session_at: string | null; onboarded_at: string | null; created_at: string; updated_at: string;
};
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
export type Habit = { id: string; client_id: string; trainer_id: string; title: string; details: string | null; days_per_week: number; active: boolean; created_at: string };

export const INTERESTS = ['Weight loss', 'Strength', 'Muscle gain', 'Running', 'Endurance', 'Mobility and flexibility',
  'TRX', 'Sports performance', 'Nutrition', 'Injury recovery', 'Healthy habits', 'Stress relief', 'Group training'];

export type Metric = 'reps' | 'time' | 'distance';
export type Exercise = {
  id: string; trainer_id: string; name: string; instructions: string | null; video_url: string | null;
  equipment: string[]; muscles: string[]; tags: string[]; default_metric: Metric; archived: boolean;
};

/** Timer spec a timed block hands to Lapis: rounds of work/rest in seconds. */
export type TimerSpec = { rounds: number; work: number; rest: number; label?: string };

/** What a block points at: a built-in library exercise or one of the trainer's own (copied in so it still shows if edited later) */
export type ExerciseRef = { src: 'lib' | 'my'; id: string; name: string; img?: string | null; video?: string | null };
/** How a set is measured */
export type SetMetric = 'reps' | 'time' | 'distance';
/** One planned set. Text fields allow ranges like "8-10" or "RPE 8". rest/time are seconds. */
export type SetSpec = { weight?: string; reps?: string; tempo?: string; rest?: number; time?: number; distance?: string };

export type WorkoutBlock =
  | { id: string; kind: 'exercise'; ex: ExerciseRef; metric: SetMetric; sets: SetSpec[]; note?: string; group?: string | null }
  | { id: string; kind: 'timed'; name: string; exercise_ids: string[]; timer: TimerSpec; note?: string }
  | { id: string; kind: 'note'; text: string };
export type ExerciseBlock = Extract<WorkoutBlock, { kind: 'exercise' }>;

export type Workout = {
  id: string; trainer_id: string; name: string; description: string | null; blocks: WorkoutBlock[]; archived: boolean;
  folder_id: string | null; cover: string | null; last_used_at: string | null; created_at: string; updated_at: string;
};
export type Folder = { id: string; trainer_id: string; name: string };
export type ProgramDay = { week: number; day: number; workout_id: string };
export type Program = { id: string; trainer_id: string; name: string; description: string | null; weeks: number; schedule: ProgramDay[]; archived: boolean; folder_id: string | null; cover: string | null; updated_at: string };
export type MyExercise = {
  id: string; trainer_id: string; name: string; instructions: string | null; video_url: string | null;
  equipment: string[]; muscles: string[]; tags: string[]; default_metric: SetMetric; archived: boolean;
  category: string; secondary_muscles: string[]; image_path: string | null; alternatives: string[];
};

export type Assignment = {
  id: string; trainer_id: string; client_id: string; workout_id: string | null; program_id: string | null;
  scheduled_on: string; title: string; snapshot: WorkoutBlock[]; trainer_note: string | null;
  status: 'scheduled' | 'done' | 'skipped'; completed_at: string | null;
};

/** What was actually done in one set (weight in the trainer's display unit, recorded in `unit`) */
export type SetLog = { weight?: number | null; reps?: number | null; time?: number | null; distance?: string | null; done: boolean };
export type LogEntry = { block_id: string; ex?: ExerciseRef; sets: SetLog[]; unit?: 'lb' | 'kg'; swapped_from?: string };
export type WorkoutLog = {
  id: string; assignment_id: string | null; client_id: string; user_id: string; performed_at: string;
  duration_seconds: number | null; entries: LogEntry[]; rpe: number | null; note: string | null; source: 'app' | 'lapis' | 'trainer';
};

export type Team = { id: string; owner_id: string; name: string };
export type TeamMember = { id: string; team_id: string; trainer_id: string | null; email: string; display_name: string; role: 'owner' | 'trainer'; status: 'invited' | 'active' | 'removed'; created_at: string };

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
  if (/row-level security|permission denied|42501/i.test(m)) return 'You don’t have access to that.';
  if (/duplicate key|already exists/i.test(m)) return 'That’s already done.';
  if (/Network request failed|Failed to fetch/i.test(m)) return 'Can’t reach the server. Check your connection and try again.';
  return m || 'Something went wrong. Try again.';
}

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
