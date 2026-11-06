-- The shared Dragonfly library, with oversight. Trainers keep creating their own private exercises (coach_exercises) and use
-- them with their clients as before. Suggesting one for the official library goes through review:
--   1. The coach-exercise-submit edge function has an AI compare it with the most similar library exercises. Thin or unsafe
--      suggestions (and names the library already has) are answered straight away and nothing is queued.
--   2. Otherwise the AI's proposal waits in coach_exercise_submissions (outcome 'pending'): either extra search names for an
--      existing exercise, or a written-up new variation.
--   3. A Dragonfly admin approves or declines it (coach_review_submission). Only then does it reach coach_library_aliases or
--      coach_library_extra, which every app loads.
-- Anyone signed in can report a library exercise as redundant or problematic (coach_exercise_reports, reviewed by admins),
-- and hide exercises they never want to see (coach_hidden_exercises, private to them).
-- Also retires the earlier still-image library (Free Exercise DB): the one saved workout block that used it moves to the
-- matching Dragonfly Coach library exercise.

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
  ai_decision text not null check (ai_decision in ('same', 'add', 'needs_detail', 'reject')),
  -- pending: waiting for an admin; approved/declined: an admin decided; the rest were answered by the AI review
  outcome text not null check (outcome in ('pending', 'approved', 'declined', 'already_listed', 'needs_detail', 'rejected')),
  proposal jsonb,          -- {kind:'alias', ref, names[]} or {kind:'add', ref, row}
  match_ref text,
  reason text check (char_length(reason) <= 1000),
  review_note text check (char_length(review_note) <= 1000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index coach_exercise_submissions_trainer_idx on public.coach_exercise_submissions (trainer_id, created_at desc);
create index coach_exercise_submissions_pending_idx on public.coach_exercise_submissions (created_at) where outcome = 'pending';

create table public.coach_exercise_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ref text not null check (ref ~ '^lib:[a-z0-9-]{1,124}$'),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('redundant', 'wrong_video', 'unclear', 'unsafe', 'other')),
  note text check (char_length(note) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_note text check (char_length(admin_note) <= 1000),
  created_at timestamptz not null default now()
);
create index coach_exercise_reports_open_idx on public.coach_exercise_reports (created_at) where status = 'open';

create table public.coach_hidden_exercises (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ref text not null check (char_length(ref) between 4 and 130),
  created_at timestamptz not null default now(),
  primary key (user_id, ref)
);

-- Reporters can't change a report after sending it; admins only set its status and note. At most 30 reports a day each.
create function public.coach_exercise_report_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.coach_exercise_reports where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
      raise exception 'report_limit' using errcode = 'P0001';
    end if;
    new.status := 'open'; new.admin_note := null;
  elsif (new.user_id, new.ref, new.name, new.kind, new.note, new.created_at) is distinct from (old.user_id, old.ref, old.name, old.kind, old.note, old.created_at) then
    raise exception 'report_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger coach_exercise_report_guard before insert or update on public.coach_exercise_reports for each row execute function public.coach_exercise_report_guard();

-- An admin approves (the proposal joins the library) or declines a pending suggestion
create function public.coach_review_submission(sid uuid, approve boolean, note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare s public.coach_exercise_submissions; n text;
begin
  if not public.dragonfly_is_admin() then raise exception 'admins_only' using errcode = '42501'; end if;
  select * into s from public.coach_exercise_submissions where id = sid for update;
  if s.id is null or s.outcome <> 'pending' then raise exception 'not_pending' using errcode = 'P0001'; end if;
  if approve then
    if s.proposal->>'kind' = 'alias' then
      for n in select jsonb_array_elements_text(s.proposal->'names') loop
        insert into public.coach_library_aliases (ref, alias, submission_id) values (s.proposal->>'ref', n, s.id) on conflict do nothing;
      end loop;
    elsif s.proposal->>'kind' = 'add' then
      insert into public.coach_library_extra (ref, data, submission_id) values (s.proposal->>'ref', s.proposal->'row', s.id);
    else raise exception 'no_proposal' using errcode = 'P0001';
    end if;
  end if;
  update public.coach_exercise_submissions set outcome = case when approve then 'approved' else 'declined' end,
    review_note = left(note, 1000), reviewed_by = auth.uid(), reviewed_at = now() where id = s.id;
  return case when approve then 'approved' else 'declined' end;
end $$;
revoke execute on function public.coach_review_submission(uuid, boolean, text) from public, anon;
grant execute on function public.coach_review_submission(uuid, boolean, text) to authenticated;
revoke execute on function public.coach_exercise_report_guard() from public, anon, authenticated;

alter table public.coach_library_extra enable row level security;
alter table public.coach_library_aliases enable row level security;
alter table public.coach_exercise_submissions enable row level security;
alter table public.coach_exercise_reports enable row level security;
alter table public.coach_hidden_exercises enable row level security;
revoke all on public.coach_library_extra, public.coach_library_aliases, public.coach_exercise_submissions, public.coach_exercise_reports, public.coach_hidden_exercises from anon;
revoke insert, update, delete on public.coach_library_extra, public.coach_library_aliases, public.coach_exercise_submissions from authenticated;
revoke delete on public.coach_exercise_reports from authenticated;
grant select on public.coach_library_extra, public.coach_library_aliases, public.coach_exercise_submissions to authenticated;
grant select, insert, update on public.coach_exercise_reports to authenticated;
grant select, insert, delete on public.coach_hidden_exercises to authenticated;
create policy coach_library_extra_read on public.coach_library_extra for select to authenticated using (true);
create policy coach_library_aliases_read on public.coach_library_aliases for select to authenticated using (true);
create policy coach_exercise_submissions_read on public.coach_exercise_submissions for select to authenticated
  using (trainer_id = (select auth.uid()) or (select public.dragonfly_is_admin()));
create policy coach_exercise_reports_read on public.coach_exercise_reports for select to authenticated
  using (user_id = (select auth.uid()) or (select public.dragonfly_is_admin()));
create policy coach_exercise_reports_send on public.coach_exercise_reports for insert to authenticated with check (user_id = (select auth.uid()));
create policy coach_exercise_reports_review on public.coach_exercise_reports for update to authenticated
  using ((select public.dragonfly_is_admin())) with check ((select public.dragonfly_is_admin()));
create policy coach_hidden_exercises_own on public.coach_hidden_exercises for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Retire the Free Exercise DB: point the old Barbell_Squat block at the Coach library's high-bar back squat
update public.coach_workouts w
set blocks = (
  select jsonb_agg(case when b->'ex'->>'src' = 'lib' and b->'ex'->>'id' = 'Barbell_Squat'
    then jsonb_set(jsonb_set(jsonb_set(b, '{ex,id}', '"c-barbell-high-bar-back-squat"'), '{ex,name}', '"Barbell High-Bar Back Squat"'), '{ex,img}', 'null')
    else b end order by ord)
  from jsonb_array_elements(w.blocks) with ordinality as t(b, ord))
where w.blocks @> '[{"ex": {"src": "lib", "id": "Barbell_Squat"}}]';
