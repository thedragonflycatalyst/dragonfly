-- Dragonfly (coaching), phase 0/1 core: trainers, clients, exercise library,
-- workouts, programs, assignments and workout logs.
-- Every table is coach_-prefixed, keyed to the shared Dragonfly account (auth.users),
-- and locked down with row-level security:
--   * a trainer sees and edits only their own library and their own clients
--   * a client sees only their own assignments and logs, plus what their trainer shared with them

-- ---------------------------------------------------------------- tables

create table public.coach_trainers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  business_name text check (char_length(business_name) <= 120),
  bio text check (char_length(bio) <= 2000),
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create table public.coach_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  -- Linked to the Dragonfly account with this email the first time that person signs in (coach_link_me)
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status text not null default 'invited' check (status in ('invited', 'active', 'paused', 'archived')),
  goals text check (char_length(goals) <= 4000),
  started_on date,
  created_at timestamptz not null default now(),
  unique (trainer_id, user_id)
);
create index coach_clients_user_idx on public.coach_clients (user_id);
create unique index coach_clients_trainer_email on public.coach_clients (trainer_id, lower(email));
create index coach_clients_email_idx on public.coach_clients (lower(email)) where user_id is null;

-- Trainer-only notes about a client (never visible to the client)
create table public.coach_client_notes (
  client_id uuid primary key references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  notes text not null default '' check (char_length(notes) <= 20000),
  updated_at timestamptz not null default now()
);

create table public.coach_exercises (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  instructions text check (char_length(instructions) <= 8000),
  video_url text check (char_length(video_url) <= 1000),   -- link (YouTube etc.) or storage path
  equipment text[] not null default '{}',
  muscles text[] not null default '{}',
  tags text[] not null default '{}',
  default_metric text not null default 'reps' check (default_metric in ('reps', 'time', 'distance')),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_exercises_trainer_idx on public.coach_exercises (trainer_id) where not archived;

-- A workout is an ordered list of blocks kept as JSON (see app/src/lib/model.ts: WorkoutBlock).
-- Timed blocks carry a timer spec that Lapis can run.
create table public.coach_workouts (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 4000),
  blocks jsonb not null default '[]' check (jsonb_typeof(blocks) = 'array'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_workouts_trainer_idx on public.coach_workouts (trainer_id) where not archived;

-- A program is a multi-week plan: schedule = [{ week, day (1-7), workout_id }]
create table public.coach_programs (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 4000),
  weeks int not null default 4 check (weeks between 1 and 52),
  schedule jsonb not null default '[]' check (jsonb_typeof(schedule) = 'array'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One workout on one day for one client. The workout is copied in (snapshot) so later
-- edits to the template don't change what the client already did.
create table public.coach_assignments (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  workout_id uuid references public.coach_workouts(id) on delete set null,
  program_id uuid references public.coach_programs(id) on delete set null,
  scheduled_on date not null,
  title text not null check (char_length(title) between 1 and 120),
  snapshot jsonb not null default '[]' check (jsonb_typeof(snapshot) = 'array'),
  trainer_note text check (char_length(trainer_note) <= 4000),
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index coach_assignments_client_day_idx on public.coach_assignments (client_id, scheduled_on);
create index coach_assignments_trainer_day_idx on public.coach_assignments (trainer_id, scheduled_on);

-- What the client actually did. entries = [{ block_id, exercise_id, sets: [{ reps, load, unit, seconds, done }] }]
create table public.coach_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.coach_assignments(id) on delete set null,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  performed_at timestamptz not null default now(),
  duration_seconds int check (duration_seconds between 0 and 86400),
  entries jsonb not null default '[]' check (jsonb_typeof(entries) = 'array'),
  rpe smallint check (rpe between 1 and 10),
  note text check (char_length(note) <= 4000),
  source text not null default 'app' check (source in ('app', 'lapis', 'trainer')),
  created_at timestamptz not null default now()
);
create index coach_logs_client_idx on public.coach_logs (client_id, performed_at desc);
create unique index coach_logs_one_per_assignment on public.coach_logs (assignment_id) where assignment_id is not null;

-- ---------------------------------------------------------------- helpers
-- security definer so policies can ask "whose client is this?" without recursive RLS.

create function public.coach_is_trainer() returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.coach_trainers t where t.user_id = auth.uid()) $$;

create function public.coach_owns_client(cid uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.coach_clients c where c.id = cid and c.trainer_id = auth.uid()) $$;

create function public.coach_is_client(cid uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.coach_clients c where c.id = cid and c.user_id = auth.uid() and c.status <> 'archived') $$;

-- Trainers whose active client the caller is
create function public.coach_my_trainer_ids() returns setof uuid
language sql stable security definer set search_path = '' as
$$ select c.trainer_id from public.coach_clients c where c.user_id = auth.uid() and c.status <> 'archived' $$;

-- ---------------------------------------------------------------- guards

create function public.coach_touch() returns trigger language plpgsql set search_path = '' as
$$ begin new.updated_at := now(); return new; end $$;
create trigger coach_exercises_touch before update on public.coach_exercises for each row execute function public.coach_touch();
create trigger coach_workouts_touch before update on public.coach_workouts for each row execute function public.coach_touch();
create trigger coach_programs_touch before update on public.coach_programs for each row execute function public.coach_touch();
create trigger coach_notes_touch before update on public.coach_client_notes for each row execute function public.coach_touch();

-- Rows a trainer writes must point at that trainer's own clients / workouts / programs
create function public.coach_assignment_guard() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if not exists (select 1 from public.coach_clients c where c.id = new.client_id and c.trainer_id = new.trainer_id) then
    raise exception 'client does not belong to this trainer' using errcode = '42501';
  end if;
  if new.workout_id is not null and not exists (select 1 from public.coach_workouts w where w.id = new.workout_id and w.trainer_id = new.trainer_id) then
    raise exception 'workout does not belong to this trainer' using errcode = '42501';
  end if;
  if new.program_id is not null and not exists (select 1 from public.coach_programs p where p.id = new.program_id and p.trainer_id = new.trainer_id) then
    raise exception 'program does not belong to this trainer' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.client_id <> old.client_id or new.trainer_id <> old.trainer_id) then
    raise exception 'an assignment cannot move between clients' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger coach_assignments_guard before insert or update on public.coach_assignments
  for each row execute function public.coach_assignment_guard();

create function public.coach_child_guard() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if not exists (select 1 from public.coach_clients c where c.id = new.client_id and c.trainer_id = new.trainer_id) then
    raise exception 'client does not belong to this trainer' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger coach_notes_guard before insert or update on public.coach_client_notes
  for each row execute function public.coach_child_guard();

-- Only coach_link_me may attach a Dragonfly account to a client row; a trainer can't point a
-- client record at someone else's account. Once linked, the email can't be changed under them.
create function public.coach_client_guard() returns trigger
language plpgsql set search_path = '' as
$$
begin
  if coalesce(current_setting('coach.linking', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.user_id := null;
      if new.status = 'active' then new.status := 'invited'; end if;
    else
      new.user_id := old.user_id;
      if old.user_id is not null and lower(new.email) <> lower(old.email) then
        raise exception 'this client is already linked to an account' using errcode = '42501';
      end if;
      if new.trainer_id <> old.trainer_id then raise exception 'a client cannot move between trainers' using errcode = '42501'; end if;
      if old.user_id is null and new.status = 'active' then new.status := 'invited'; end if;
    end if;
  end if;
  return new;
end
$$;
create trigger coach_clients_guard before insert or update on public.coach_clients
  for each row execute function public.coach_client_guard();

-- A client logging a workout: the log must be theirs and the assignment theirs.
-- Logging an assignment marks it done.
create function public.coach_log_guard() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if tg_op = 'UPDATE' and (new.client_id <> old.client_id or new.user_id <> old.user_id
      or new.assignment_id is distinct from old.assignment_id) then
    raise exception 'a log cannot be moved' using errcode = '42501';
  end if;
  if new.assignment_id is not null and not exists (
      select 1 from public.coach_assignments a where a.id = new.assignment_id and a.client_id = new.client_id) then
    raise exception 'assignment does not belong to this client' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger coach_logs_guard before insert or update on public.coach_logs
  for each row execute function public.coach_log_guard();

create function public.coach_log_completes() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if new.assignment_id is not null then
    update public.coach_assignments set status = 'done', completed_at = new.performed_at where id = new.assignment_id;
  end if;
  return new;
end
$$;
create trigger coach_logs_complete after insert on public.coach_logs
  for each row execute function public.coach_log_completes();

-- ---------------------------------------------------------------- RPCs

-- Client, on every sign-in: attach any client records a trainer created for this person's
-- confirmed email address. Returns how many were linked.
create function public.coach_link_me() returns int
language plpgsql security definer set search_path = '' as
$$
declare v_email text; v_n int;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  perform set_config('coach.linking', 'on', true);
  update public.coach_clients c set user_id = auth.uid(), status = case when c.status = 'invited' then 'active' else c.status end,
         started_on = coalesce(c.started_on, current_date)
   where c.user_id is null and lower(c.email) = lower(v_email) and c.status <> 'archived' and c.trainer_id <> auth.uid();
  get diagnostics v_n = row_count;
  perform set_config('coach.linking', '', true);
  return v_n;
end
$$;

-- Server only (coach-invite function): does a Dragonfly account exist for this email, and has it ever signed in?
create function public.coach_account_for_email(p_email text) returns table (user_id uuid, signed_in boolean)
language sql stable security definer set search_path = '' as
$$ select u.id, u.last_sign_in_at is not null from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1 $$;

-- Trainer: copy a program's schedule onto a client's calendar from a start date (a Monday or any day).
create function public.coach_assign_program(p_program uuid, p_client uuid, p_start date) returns int
language plpgsql security definer set search_path = '' as
$$
declare v_prog public.coach_programs%rowtype; v_n int := 0; s jsonb; w public.coach_workouts%rowtype;
begin
  select * into v_prog from public.coach_programs where id = p_program and trainer_id = auth.uid();
  if not found or not public.coach_owns_client(p_client) then
    raise exception 'not your program or client' using errcode = '42501';
  end if;
  for s in select * from jsonb_array_elements(v_prog.schedule) loop
    select * into w from public.coach_workouts where id = (s->>'workout_id')::uuid and trainer_id = auth.uid();
    continue when not found;
    insert into public.coach_assignments (trainer_id, client_id, workout_id, program_id, scheduled_on, title, snapshot)
    values (auth.uid(), p_client, w.id, v_prog.id,
            p_start + ((s->>'week')::int - 1) * 7 + ((s->>'day')::int - 1), w.name, w.blocks);
    v_n := v_n + 1;
  end loop;
  return v_n;
end
$$;

-- Names (Dragonfly usernames) of the people linked to the caller: a trainer's clients, a client's trainers.
create function public.coach_people() returns table (user_id uuid, username text, relation text)
language sql stable security definer set search_path = '' as
$$
  select p.user_id, p.username, 'client' from public.coach_clients c join public.dragonfly_profiles p on p.user_id = c.user_id
    where c.trainer_id = auth.uid()
  union
  select p.user_id, p.username, 'trainer' from public.coach_clients c join public.dragonfly_profiles p on p.user_id = c.trainer_id
    where c.user_id = auth.uid() and c.status <> 'archived'
$$;

revoke execute on function public.coach_is_trainer(), public.coach_owns_client(uuid), public.coach_is_client(uuid),
  public.coach_my_trainer_ids(), public.coach_link_me(), public.coach_assign_program(uuid, uuid, date),
  public.coach_people() from public, anon;
grant execute on function public.coach_is_trainer(), public.coach_owns_client(uuid), public.coach_is_client(uuid),
  public.coach_my_trainer_ids(), public.coach_link_me(), public.coach_assign_program(uuid, uuid, date),
  public.coach_people() to authenticated;
revoke execute on function public.coach_account_for_email(text) from public, anon, authenticated;
grant execute on function public.coach_account_for_email(text) to service_role;
revoke execute on function public.coach_touch(), public.coach_assignment_guard(), public.coach_child_guard(),
  public.coach_client_guard(), public.coach_log_guard(), public.coach_log_completes() from public, anon, authenticated;

-- ---------------------------------------------------------------- row-level security

alter table public.coach_trainers enable row level security;
alter table public.coach_clients enable row level security;
alter table public.coach_client_notes enable row level security;
alter table public.coach_exercises enable row level security;
alter table public.coach_workouts enable row level security;
alter table public.coach_programs enable row level security;
alter table public.coach_assignments enable row level security;
alter table public.coach_logs enable row level security;

-- Nothing for anonymous visitors
revoke all on public.coach_trainers, public.coach_clients, public.coach_client_notes,
  public.coach_exercises, public.coach_workouts, public.coach_programs, public.coach_assignments, public.coach_logs from anon;
grant select, insert, update, delete on public.coach_trainers, public.coach_clients, public.coach_client_notes,
  public.coach_exercises, public.coach_workouts, public.coach_programs, public.coach_assignments, public.coach_logs to authenticated;

-- Trainers: anyone signed in can set up their own trainer profile; clients can read their trainer's profile
create policy coach_trainers_read on public.coach_trainers for select to authenticated
  using (user_id = (select auth.uid()) or user_id in (select public.coach_my_trainer_ids()));
create policy coach_trainers_insert on public.coach_trainers for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy coach_trainers_update on public.coach_trainers for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy coach_trainers_delete on public.coach_trainers for delete to authenticated
  using (user_id = (select auth.uid()));

-- Clients: the trainer manages them; the client can read their own row (not change it)
create policy coach_clients_trainer on public.coach_clients for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_clients_self on public.coach_clients for select to authenticated
  using (user_id = (select auth.uid()));

create policy coach_notes_trainer on public.coach_client_notes for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));

-- Library (exercises, workouts, programs): the trainer owns it; their clients can read it
create policy coach_exercises_trainer on public.coach_exercises for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_exercises_client on public.coach_exercises for select to authenticated
  using (trainer_id in (select public.coach_my_trainer_ids()));
create policy coach_workouts_trainer on public.coach_workouts for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_programs_trainer on public.coach_programs for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));

-- Assignments: the trainer manages them; the client reads their own
create policy coach_assignments_trainer on public.coach_assignments for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_assignments_client on public.coach_assignments for select to authenticated
  using (public.coach_is_client(client_id));

-- Logs: user_id = who wrote it. A client reads all logs about them and writes their own;
-- the trainer reads their clients' logs and can add one for a session they ran.
create policy coach_logs_read on public.coach_logs for select to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id));
create policy coach_logs_client_insert on public.coach_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and public.coach_is_client(client_id) and source in ('app', 'lapis'));
create policy coach_logs_trainer_insert on public.coach_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and public.coach_owns_client(client_id) and source = 'trainer');
create policy coach_logs_author_update on public.coach_logs for update to authenticated
  using (user_id = (select auth.uid()) and (public.coach_is_client(client_id) or public.coach_owns_client(client_id)))
  with check (user_id = (select auth.uid()));
create policy coach_logs_author_delete on public.coach_logs for delete to authenticated
  using (user_id = (select auth.uid()) and (public.coach_is_client(client_id) or public.coach_owns_client(client_id)));
