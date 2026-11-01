-- Dragonfly (coaching): the Workouts tab.
-- Workout folders, covers, exercise favorites, trainer exercise demo videos, and the client's own
-- "skip" on an assigned workout. Workouts themselves (coach_workouts.blocks) and logging (coach_logs)
-- already exist; see app/src/lib/model.ts for the block shape.

create table public.coach_workout_folders (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (trainer_id, name)
);

alter table public.coach_workouts
  add column folder_id uuid references public.coach_workout_folders(id) on delete set null,
  add column cover text check (char_length(cover) <= 300),          -- a preset key ('preset:3') or a storage path
  add column last_used_at timestamptz;
alter table public.coach_programs
  add column folder_id uuid references public.coach_workout_folders(id) on delete set null;

-- A folder on a workout or program must be the same trainer's
create function public.coach_folder_guard() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if new.folder_id is not null and not exists (
      select 1 from public.coach_workout_folders f where f.id = new.folder_id and f.trainer_id = new.trainer_id) then
    raise exception 'folder does not belong to this trainer' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger coach_workouts_folder_guard before insert or update on public.coach_workouts for each row execute function public.coach_folder_guard();
create trigger coach_programs_folder_guard before insert or update on public.coach_programs for each row execute function public.coach_folder_guard();

-- Assigning a workout marks it recently used (for "most recent" sorting)
create function public.coach_mark_workout_used() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if new.workout_id is not null then
    update public.coach_workouts set last_used_at = now() where id = new.workout_id;
  end if;
  return new;
end
$$;
create trigger coach_assignments_mark_used after insert on public.coach_assignments for each row execute function public.coach_mark_workout_used();

-- Favorite exercises: 'lib:<id>' for built-in exercises or 'my:<uuid>' for the trainer's own
create table public.coach_exercise_favorites (
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  ref text not null check (ref ~ '^(lib|my):[A-Za-z0-9_.()\-]{1,120}$'),
  created_at timestamptz not null default now(),
  primary key (trainer_id, ref)
);

-- Client skips (or un-skips) one of their assigned workouts
create function public.coach_set_assignment_skipped(p_assignment uuid, p_skipped boolean) returns void
language plpgsql security definer set search_path = '' as
$$
declare a public.coach_assignments%rowtype;
begin
  select * into a from public.coach_assignments where id = p_assignment for update;
  if not found or not public.coach_is_client(a.client_id) then raise exception 'not your workout' using errcode = '42501'; end if;
  if a.status = 'done' then raise exception 'workout_already_done' using errcode = 'P0001'; end if;
  update public.coach_assignments set status = case when p_skipped then 'skipped' else 'scheduled' end where id = p_assignment;
end
$$;

-- Trainer's exercise demo videos live in the private coach-media bucket: {trainer_id}/exercises/{file}.
-- The trainer and their active clients can watch them.
create function public.coach_media_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as
$$
  select split_part(p_name, '/', 2) = 'exercises' and (
    split_part(p_name, '/', 1) = auth.uid()::text
    or exists (select 1 from public.coach_clients c
                where c.trainer_id::text = split_part(p_name, '/', 1) and c.user_id = auth.uid() and c.status = 'active'))
$$;

revoke execute on function public.coach_set_assignment_skipped(uuid, boolean), public.coach_media_ok(text) from public, anon;
grant execute on function public.coach_set_assignment_skipped(uuid, boolean), public.coach_media_ok(text) to authenticated;
revoke execute on function public.coach_folder_guard(), public.coach_mark_workout_used() from public, anon, authenticated;

alter table public.coach_workout_folders enable row level security;
alter table public.coach_exercise_favorites enable row level security;
revoke all on public.coach_workout_folders, public.coach_exercise_favorites from anon;
grant select, insert, update, delete on public.coach_workout_folders, public.coach_exercise_favorites to authenticated;
create policy coach_workout_folders_trainer on public.coach_workout_folders for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_exercise_favorites_trainer on public.coach_exercise_favorites for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
