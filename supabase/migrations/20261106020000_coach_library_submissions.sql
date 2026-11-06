-- Trainers suggest exercises for the shared Dragonfly library instead of adding to it directly. The coach-exercise-submit
-- edge function has an AI compare each suggestion with the most similar library exercises and then:
--   * the same move under another name  -> the name is added to coach_library_aliases (search finds the existing move)
--   * a distinct, well-described variation -> it is written up and added to coach_library_extra for everyone
--   * too thin to judge, or not a real/safe exercise -> nothing is added; the trainer is told why
-- Every review is kept in coach_exercise_submissions. Only the edge function (service role) writes these tables.
-- Also retires the earlier still-image library (Free Exercise DB): the one saved workout block that used it is moved to
-- the matching Dragonfly Coach library exercise.

create table public.coach_library_extra (
  ref text primary key check (ref ~ '^lib:x-[a-z0-9-]{1,118}$'),
  data jsonb not null check (jsonb_typeof(data) = 'array'),   -- one row in the shape of app/src/data/coach-library.json
  submission_id uuid,
  created_at timestamptz not null default now()
);

create table public.coach_library_aliases (
  id bigint generated always as identity primary key,
  ref text not null check (ref ~ '^lib:[a-z0-9-]{1,124}$'),
  alias text not null check (char_length(alias) between 2 and 120),
  submission_id uuid,
  created_at timestamptz not null default now()
);
create unique index coach_library_aliases_uq on public.coach_library_aliases (ref, lower(alias));

create table public.coach_exercise_submissions (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  exercise jsonb not null,
  outcome text not null check (outcome in ('alias', 'added', 'already_listed', 'needs_detail', 'rejected')),
  match_ref text,
  reason text check (char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);
create index coach_exercise_submissions_trainer_idx on public.coach_exercise_submissions (trainer_id, created_at desc);

alter table public.coach_library_extra enable row level security;
alter table public.coach_library_aliases enable row level security;
alter table public.coach_exercise_submissions enable row level security;
revoke all on public.coach_library_extra, public.coach_library_aliases, public.coach_exercise_submissions from anon;
revoke insert, update, delete on public.coach_library_extra, public.coach_library_aliases, public.coach_exercise_submissions from authenticated;
grant select on public.coach_library_extra, public.coach_library_aliases, public.coach_exercise_submissions to authenticated;
create policy coach_library_extra_read on public.coach_library_extra for select to authenticated using (true);
create policy coach_library_aliases_read on public.coach_library_aliases for select to authenticated using (true);
create policy coach_exercise_submissions_own on public.coach_exercise_submissions for select to authenticated using (trainer_id = (select auth.uid()));

-- Retire the Free Exercise DB: point the old Barbell_Squat block at the Coach library's high-bar back squat
update public.coach_workouts w
set blocks = (
  select jsonb_agg(case when b->'ex'->>'src' = 'lib' and b->'ex'->>'id' = 'Barbell_Squat'
    then jsonb_set(jsonb_set(jsonb_set(b, '{ex,id}', '"c-barbell-high-bar-back-squat"'), '{ex,name}', '"Barbell High-Bar Back Squat"'), '{ex,img}', 'null')
    else b end order by ord)
  from jsonb_array_elements(w.blocks) with ordinality as t(b, ord))
where w.blocks @> '[{"ex": {"src": "lib", "id": "Barbell_Squat"}}]';
