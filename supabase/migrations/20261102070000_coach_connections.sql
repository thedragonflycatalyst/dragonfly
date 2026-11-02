-- Dragonfly (coaching): connections to other health apps.
--
-- Data arrives three ways: Health Connect (Android) and Apple Health (iPhone) read on the device; Strava, Oura and
-- Whoop through their own APIs (the coach-connect edge function holds the tokens); and CSV imports from food apps
-- (Cronometer, MyFitnessPal…). Daily totals go in coach_health_daily, workouts in coach_activities, food in the diary.
-- Like weigh-ins, this belongs to the person; their trainer can read it.

create table public.coach_health_daily (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  steps int check (steps between 0 and 200000),
  active_kcal int check (active_kcal between 0 and 20000),
  distance_m int check (distance_m between 0 and 1000000),
  sleep_min int check (sleep_min between 0 and 1440),
  resting_hr int check (resting_hr between 20 and 250),
  hrv_ms numeric(6,1) check (hrv_ms between 0 and 500),
  readiness int check (readiness between 0 and 100),       -- Oura readiness / Whoop recovery
  water_ml int check (water_ml between 0 and 20000),
  sources text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table public.coach_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null check (source in ('health_connect', 'apple_health', 'strava', 'oura', 'whoop', 'garmin')),
  external_id text not null check (char_length(external_id) between 1 and 200),
  kind text not null check (char_length(kind) between 1 and 60),
  name text check (char_length(name) <= 200),
  started_at timestamptz not null,
  duration_s int check (duration_s between 0 and 172800),
  distance_m int check (distance_m between 0 and 1000000),
  kcal int check (kcal between 0 and 20000),
  avg_hr int check (avg_hr between 20 and 250),
  app text check (char_length(app) <= 120),                 -- which app recorded it (Garmin Connect, Samsung Health…)
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index coach_activities_user_idx on public.coach_activities (user_id, started_at desc);

-- Connected accounts (what the person sees); the tokens live in a table only the edge function can read
create table public.coach_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('strava', 'oura', 'whoop')),
  account text check (char_length(account) <= 200),
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  status text not null default 'ok' check (status in ('ok', 'expired', 'error')),
  primary key (user_id, provider)
);
create table public.coach_connection_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  primary key (user_id, provider)
);
create table public.coach_oauth_states (
  state text primary key check (char_length(state) between 20 and 100),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  return_to text check (char_length(return_to) <= 300),
  created_at timestamptz not null default now()
);

-- Food from other apps lands in the diary; external_id stops the same entry coming in twice
alter table public.coach_food_logs drop constraint coach_food_logs_source_check;
alter table public.coach_food_logs add constraint coach_food_logs_source_check
  check (source in ('search', 'plan', 'barcode', 'quick', 'photo', 'ai', 'saved', 'health_connect', 'apple_health', 'import'));
alter table public.coach_food_logs add column external_id text check (char_length(external_id) <= 200);
create unique index coach_food_logs_external_idx on public.coach_food_logs (client_id, external_id) where external_id is not null;

-- Habits can tick themselves off from synced data ("8,000 steps", "7 hours of sleep")
alter table public.coach_habits
  add column auto_metric text check (auto_metric in ('steps', 'sleep_hours', 'water_ml', 'active_kcal')),
  add column auto_target numeric check (auto_target > 0 and auto_target <= 200000);
alter table public.coach_habit_library
  add column auto_metric text check (auto_metric in ('steps', 'sleep_hours', 'water_ml', 'active_kcal')),
  add column auto_target numeric check (auto_target > 0 and auto_target <= 200000);

create function public.coach_health_ticks() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  insert into public.coach_habit_checks (habit_id, day, checked_by)
  select h.id, new.day, new.user_id
    from public.coach_habits h join public.coach_clients c on c.id = h.client_id
   where c.user_id = new.user_id and c.status = 'active' and h.active and h.auto_metric is not null and new.day <= current_date
     and case h.auto_metric
           when 'steps' then new.steps >= h.auto_target
           when 'sleep_hours' then new.sleep_min >= h.auto_target * 60
           when 'water_ml' then new.water_ml >= h.auto_target
           when 'active_kcal' then new.active_kcal >= h.auto_target
         end
  on conflict do nothing;
  return null;
end
$$;
create trigger coach_health_daily_ticks after insert or update on public.coach_health_daily for each row execute function public.coach_health_ticks();

-- Trainer: subscribe to your Dragonfly calendar from Google, Outlook or Apple (secret feed link), and block out
-- times from your own calendar (its private iCal link) so clients can't book over them
alter table public.coach_trainer_details
  add column calendar_token text unique check (char_length(calendar_token) between 20 and 80),
  add column busy_ics_url text check (busy_ics_url ~ '^(https|webcal)://' and char_length(busy_ics_url) <= 1000);
create table public.coach_external_busy (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  title text check (char_length(title) <= 200),
  check (ends_at > starts_at)
);
create index coach_external_busy_idx on public.coach_external_busy (trainer_id, starts_at);

-- Busy times from the trainer's own calendar block client bookings too
create or replace function public.coach_trainer_busy(p_trainer uuid, p_days int default 21) returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as
$$
declare tz text; d date;
begin
  if public.coach_my_client_id(p_trainer) is null then raise exception 'not your trainer' using errcode = '42501'; end if;
  select timezone into tz from public.coach_trainers where user_id = p_trainer;
  tz := coalesce(tz, 'UTC');
  for d in select generate_series((now() at time zone tz)::date, (now() at time zone tz)::date + least(greatest(p_days, 1), 60), interval '1 day')::date loop
    return query select lower(r), upper(r) from (select public.coach_booking_on(b, d, tz) r from public.coach_bookings b where b.trainer_id = p_trainer) x where r is not null;
  end loop;
  return query select e.starts_at, e.starts_at + make_interval(mins => e.duration_min) from public.coach_events e
    where e.trainer_id = p_trainer and not e.cancelled and e.starts_at > now() and e.starts_at < now() + make_interval(days => p_days + 1);
  return query select x.starts_at, x.ends_at from public.coach_external_busy x
    where x.trainer_id = p_trainer and x.ends_at > now() and x.starts_at < now() + make_interval(days => p_days + 1);
end
$$;

create or replace function public.coach_book_session(p_trainer uuid, p_starts timestamptz, p_minutes int, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as
$$
declare c uuid := public.coach_my_client_id(p_trainer); v uuid; tz text; loc timestamp; nm text; want tstzrange;
begin
  if c is null then raise exception 'not your trainer' using errcode = '42501'; end if;
  if not public.coach_perm(p_trainer, 'book_sessions') then raise exception 'booking_closed' using errcode = '42501'; end if;
  if p_minutes not in (30, 45, 60, 90) or p_starts < now() + interval '1 hour' or p_starts > now() + interval '120 days' then
    raise exception 'bad_time' using errcode = '22023';
  end if;
  select timezone into tz from public.coach_trainers where user_id = p_trainer;
  loc := p_starts at time zone coalesce(tz, 'UTC');
  if not exists (select 1 from public.coach_availability a where a.trainer_id = p_trainer and a.weekday = extract(dow from loc)
                  and a.start_time <= loc::time and a.end_time >= (loc + make_interval(mins => p_minutes))::time) then
    raise exception 'outside_hours' using errcode = '22023';
  end if;
  want := tstzrange(p_starts, p_starts + make_interval(mins => p_minutes));
  perform pg_advisory_xact_lock(hashtext(p_trainer::text));
  if exists (select 1 from public.coach_bookings b where b.trainer_id = p_trainer and public.coach_booking_on(b, loc::date, coalesce(tz, 'UTC')) && want)
     or exists (select 1 from public.coach_events e where e.trainer_id = p_trainer and not e.cancelled
                 and tstzrange(e.starts_at, e.starts_at + make_interval(mins => e.duration_min)) && want)
     or exists (select 1 from public.coach_external_busy x where x.trainer_id = p_trainer and tstzrange(x.starts_at, x.ends_at) && want) then
    raise exception 'slot_taken' using errcode = '22023';
  end if;
  select first_name into nm from public.coach_clients where id = c;
  insert into public.coach_bookings (trainer_id, client_id, title, kind, starts_at, duration_min, notes, booked_by)
  values (p_trainer, c, 'Session with ' || nm, 'session', p_starts, p_minutes, nullif(left(p_note, 2000), ''), 'client') returning id into v;
  return v;
end
$$;

-- ---------------------------------------------------------------- privileges and policies

revoke execute on function public.coach_health_ticks() from public, anon, authenticated;

alter table public.coach_health_daily enable row level security;
alter table public.coach_activities enable row level security;
alter table public.coach_connections enable row level security;
alter table public.coach_connection_tokens enable row level security;
alter table public.coach_oauth_states enable row level security;
alter table public.coach_external_busy enable row level security;
revoke all on public.coach_health_daily, public.coach_activities, public.coach_connections, public.coach_connection_tokens,
  public.coach_oauth_states, public.coach_external_busy from anon, authenticated;
grant select, insert, update, delete on public.coach_health_daily, public.coach_activities to authenticated;
grant select, delete on public.coach_connections to authenticated;
grant select on public.coach_external_busy to authenticated;
-- coach_connection_tokens and coach_oauth_states: no access except the service role (edge functions)

create policy coach_health_daily_own on public.coach_health_daily for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy coach_health_daily_trainer on public.coach_health_daily for select to authenticated using (public.coach_trains_user(user_id));
create policy coach_activities_own on public.coach_activities for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy coach_activities_trainer on public.coach_activities for select to authenticated using (public.coach_trains_user(user_id));
create policy coach_connections_own on public.coach_connections for select to authenticated using (user_id = (select auth.uid()));
create policy coach_connections_remove on public.coach_connections for delete to authenticated using (user_id = (select auth.uid()));
create policy coach_external_busy_trainer on public.coach_external_busy for select to authenticated using (trainer_id = (select public.coach_acting()));
