-- Routines (owner 2026-11-13). A trainer assigns a saved workout to clients as a routine: no date. The client (or the
-- trainer, in a session) opens it from the client's routines and starts it whenever they train; each start makes that
-- day's workout, so the session, log and results work exactly as before. A routine follows the trainer's latest
-- version of the workout; a workout already started or done keeps what it was.
-- Workout reminders: "work out Wednesday at 3 PM, doing Legs". The client is reminded the day before (text, email or
-- the app, by their message settings, plus a phone alert) with a link that starts that routine. Once, or every week.
-- Dated assignments and programs stay as they are.

create table public.coach_client_routines (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  workout_id uuid references public.coach_workouts(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  snapshot jsonb not null default '[]' check (jsonb_typeof(snapshot) = 'array'),
  note text check (char_length(note) <= 1000),
  active boolean not null default true,
  last_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index coach_client_routines_once on public.coach_client_routines (client_id, workout_id) where active;
create index coach_client_routines_client on public.coach_client_routines (client_id) where active;
alter table public.coach_client_routines enable row level security;
revoke all on public.coach_client_routines from anon;
grant select on public.coach_client_routines to authenticated;
create policy coach_client_routines_read on public.coach_client_routines for select to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id));

alter table public.coach_assignments add column routine_id uuid references public.coach_client_routines(id) on delete set null;

-- Editing a saved workout updates the routines that use it (what was already started or done is unchanged)
create function public.coach_routines_follow_workout() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.coach_client_routines set title = new.name, snapshot = new.blocks, updated_at = now() where workout_id = new.id and active;
  return null;
end $$;
create trigger coach_routines_follow_workout after update of name, blocks on public.coach_workouts for each row execute function public.coach_routines_follow_workout();
revoke execute on function public.coach_routines_follow_workout() from public, anon, authenticated;

-- Assign a saved workout to clients (again = the note is updated). Returns how many clients have it.
create function public.coach_assign_routine(p_workout uuid, p_clients uuid[], p_note text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare w public.coach_workouts%rowtype; c uuid; n int := 0;
begin
  select * into w from public.coach_workouts where id = p_workout;
  if not found then raise exception 'no_such_workout' using errcode = 'P0002'; end if;
  foreach c in array coalesce(p_clients, '{}') loop
    if not public.coach_owns_client(c) or not exists (select 1 from public.coach_clients x where x.id = c and x.trainer_id = w.trainer_id) then
      raise exception 'not_your_client' using errcode = '42501';
    end if;
    insert into public.coach_client_routines (trainer_id, client_id, workout_id, title, snapshot, note)
    values (w.trainer_id, c, w.id, w.name, w.blocks, nullif(left(trim(coalesce(p_note, '')), 1000), ''))
    on conflict (client_id, workout_id) where active do update set note = excluded.note, title = excluded.title, snapshot = excluded.snapshot, updated_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.coach_assign_routine(uuid, uuid[], text) from public, anon;
grant execute on function public.coach_assign_routine(uuid, uuid[], text) to authenticated;

-- Take a routine off a client's list (their history stays)
create function public.coach_remove_routine(p_routine uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.coach_client_routines set active = false, updated_at = now() where id = p_routine and public.coach_owns_client(client_id);
  if not found then raise exception 'not_your_client' using errcode = '42501'; end if;
  update public.coach_workout_reminders set active = false where routine_id = p_routine;
end $$;

-- Start a routine: today's workout from it (the same one again if today's was started and not finished)
create function public.coach_start_routine(p_routine uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.coach_client_routines%rowtype; tz text; today date; aid uuid;
begin
  select * into r from public.coach_client_routines where id = p_routine and active;
  if not found or not (public.coach_is_client(r.client_id) or public.coach_owns_client(r.client_id)) then
    raise exception 'not_your_routine' using errcode = '42501';
  end if;
  select coalesce(timezone, 'America/New_York') into tz from public.coach_trainers where user_id = r.trainer_id;
  today := (now() at time zone tz)::date;
  select a.id into aid from public.coach_assignments a
   where a.routine_id = r.id and a.scheduled_on = today and a.status = 'scheduled'
     and not exists (select 1 from public.coach_logs l where l.assignment_id = a.id)
   order by a.created_at desc limit 1;
  if aid is null then
    insert into public.coach_assignments (trainer_id, client_id, workout_id, scheduled_on, title, snapshot, trainer_note, routine_id)
    values (r.trainer_id, r.client_id, r.workout_id, today, r.title, r.snapshot, r.note, r.id) returning id into aid;
  end if;
  update public.coach_client_routines set last_started_at = now() where id = r.id;
  return aid;
end $$;
revoke execute on function public.coach_start_routine(uuid) from public, anon;
grant execute on function public.coach_start_routine(uuid) to authenticated;

-- ------------------------------------------------------------ workout reminders
create table public.coach_workout_reminders (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  routine_id uuid not null references public.coach_client_routines(id) on delete cascade,
  at timestamptz not null,                     -- when to work out (the first time, for weekly ones)
  weekly boolean not null default false,
  active boolean not null default true,
  last_notified_for timestamptz,               -- the workout time the last reminder was for (one reminder per time)
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index coach_workout_reminders_active on public.coach_workout_reminders (active) where active;
create index coach_workout_reminders_client on public.coach_workout_reminders (client_id);
alter table public.coach_workout_reminders enable row level security;
revoke all on public.coach_workout_reminders from anon;
grant select on public.coach_workout_reminders to authenticated;
create policy coach_workout_reminders_read on public.coach_workout_reminders for select to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id));

-- The trainer (or the client, for themselves) sets a reminder for a routine
create function public.coach_set_workout_reminder(p_routine uuid, p_at timestamptz, p_weekly boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.coach_client_routines%rowtype; v uuid;
begin
  select * into r from public.coach_client_routines where id = p_routine and active;
  if not found or not (public.coach_is_client(r.client_id) or public.coach_owns_client(r.client_id)) then
    raise exception 'not_your_routine' using errcode = '42501';
  end if;
  if p_at is null or (not p_weekly and p_at <= now()) or p_at > now() + interval '1 year' then raise exception 'bad_time' using errcode = '22023'; end if;
  if (select count(*) from public.coach_workout_reminders where client_id = r.client_id and active) >= 30 then raise exception 'too_many' using errcode = '22023'; end if;
  insert into public.coach_workout_reminders (trainer_id, client_id, routine_id, at, weekly, created_by)
  values (r.trainer_id, r.client_id, r.id, date_trunc('minute', p_at), p_weekly, auth.uid()) returning id into v;
  return v;
end $$;
revoke execute on function public.coach_set_workout_reminder(uuid, timestamptz, boolean) from public, anon;
grant execute on function public.coach_set_workout_reminder(uuid, timestamptz, boolean) to authenticated;

create function public.coach_stop_workout_reminder(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.coach_workout_reminders set active = false
   where id = p_id and (public.coach_is_client(client_id) or public.coach_owns_client(client_id));
  if not found then raise exception 'not_yours' using errcode = '42501'; end if;
end $$;
revoke execute on function public.coach_stop_workout_reminder(uuid) from public, anon;
grant execute on function public.coach_stop_workout_reminder(uuid) to authenticated;
revoke execute on function public.coach_remove_routine(uuid) from public, anon;
grant execute on function public.coach_remove_routine(uuid) to authenticated;

-- Reminders go out through the usual outbox (consent, quiet hours, channel), as their own kind
alter table public.coach_outbox drop constraint coach_outbox_kind_check;
alter table public.coach_outbox add constraint coach_outbox_kind_check
  check (kind in ('reminder', 'slot_offer', 'survey', 'testimonial_ask', 'referral_ask', 'group_invite', 'note', 'workout_reminder'));

-- Deleting a saved workout takes it off clients' routines (and its reminders); what they already did stays
create function public.coach_routines_workout_deleted() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.coach_workout_reminders set active = false where routine_id in (select id from public.coach_client_routines where workout_id = old.id);
  update public.coach_client_routines set active = false, updated_at = now() where workout_id = old.id;
  return old;
end $$;
create trigger coach_routines_workout_deleted before delete on public.coach_workouts for each row execute function public.coach_routines_workout_deleted();
revoke execute on function public.coach_routines_workout_deleted() from public, anon, authenticated;
