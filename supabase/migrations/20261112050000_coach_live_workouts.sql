-- Unfinished workouts submit themselves (owner 2026-11-12): "after four hours with no interaction in the workout
-- instance it automatically submits as completed and the trainer gets the result". It must work with the app closed,
-- so the app keeps a live copy of each workout in progress here (only the sets checked off, and finished timers),
-- and the server submits it once it has had no interaction for 4 hours: the assignment is marked done, the log holds
-- exactly what was checked off (anything not checked shows as not done) and the trainer gets a push.

alter table public.coach_logs add column auto_submitted boolean not null default false;

create table public.coach_workout_live (
  assignment_id uuid primary key references public.coach_assignments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  source text not null default 'app' check (source in ('app', 'trainer')),
  started_at timestamptz not null,
  touched_at timestamptz not null default now(),        -- the server's clock, set on every write
  entries jsonb not null default '[]' check (jsonb_typeof(entries) = 'array'),
  timer_results jsonb not null default '[]' check (jsonb_typeof(timer_results) = 'array')
);
create index coach_workout_live_idle on public.coach_workout_live (touched_at);
alter table public.coach_workout_live enable row level security;
revoke all on public.coach_workout_live from anon;
grant select, insert, update, delete on public.coach_workout_live to authenticated;
create policy coach_workout_live_own on public.coach_workout_live for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Only the client doing their own assignment, or their trainer running it, keeps a live copy; times come from the server
create function public.coach_workout_live_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare a public.coach_assignments%rowtype;
begin
  if auth.uid() is null then return new; end if;          -- the server itself
  select * into a from public.coach_assignments where id = new.assignment_id;
  if not found or a.client_id <> new.client_id then raise exception 'not_your_workout' using errcode = '42501'; end if;
  if a.status = 'done' then raise exception 'already_submitted' using errcode = '22023'; end if;
  if public.coach_is_client(new.client_id) then new.source := 'app';
  elsif public.coach_owns_client(new.client_id) then new.source := 'trainer';
  else raise exception 'not_your_workout' using errcode = '42501'; end if;
  new.user_id := auth.uid();
  new.touched_at := now();
  new.started_at := least(greatest(new.started_at, now() - interval '1 day'), now());
  if tg_op = 'UPDATE' then new.started_at := old.started_at; end if;
  if pg_column_size(new.entries) + pg_column_size(new.timer_results) > 200000 then raise exception 'too_big' using errcode = '22023'; end if;
  return new;
end $$;
create trigger coach_workout_live_guard before insert or update on public.coach_workout_live for each row execute function public.coach_workout_live_guard();
revoke execute on function public.coach_workout_live_guard() from public, anon, authenticated;

-- Only sets checked off count (whatever the app sends): sets with done = true, exercises with none left are dropped
create function public.coach_done_only(p jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(e || jsonb_build_object('sets', d.sets)), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p, '[]'::jsonb)) e
  cross join lateral (select jsonb_agg(s) as sets from jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) s
                      where coalesce((s->>'done')::boolean, false)) d
  where d.sets is not null
$$;

-- Every 15 minutes: workouts with no interaction for 4 hours are submitted as completed
create function public.coach_submit_idle_workouts() returns int
language plpgsql security definer set search_path = '' as $$
declare r public.coach_workout_live%rowtype; done_entries jsonb; n int := 0;
begin
  for r in select * from public.coach_workout_live where touched_at <= now() - interval '4 hours' for update skip locked loop
    done_entries := public.coach_done_only(r.entries);
    -- Already submitted (by the app), or nothing was checked off: nothing to submit; the person can still resume it
    if not exists (select 1 from public.coach_logs l where l.assignment_id = r.assignment_id)
       and (jsonb_array_length(done_entries) > 0 or jsonb_array_length(r.timer_results) > 0) then
      insert into public.coach_logs (assignment_id, client_id, user_id, performed_at, duration_seconds, entries, timer_results, note, source, auto_submitted)
      values (r.assignment_id, r.client_id, r.user_id, r.touched_at,
              least(86400, greatest(0, extract(epoch from r.touched_at - r.started_at)::int)), done_entries, r.timer_results,
              'Submitted automatically after 4 hours without activity.', r.source, true)
      on conflict (assignment_id) where assignment_id is not null do nothing;
      if found then n := n + 1; end if;
    end if;
    delete from public.coach_workout_live where assignment_id = r.assignment_id;
  end loop;
  return n;
end $$;
revoke execute on function public.coach_submit_idle_workouts() from public, anon, authenticated;
select cron.schedule('coach-submit-idle-workouts', '*/15 * * * *', $$select public.coach_submit_idle_workouts()$$);

-- The trainer gets the result: a push for every workout their client submitted, automatically or not
create function public.coach_log_push() returns trigger language plpgsql security definer set search_path = '' as $$
declare tr uuid;
begin
  select trainer_id into tr from public.coach_clients where id = new.client_id;
  if tr is null or tr = new.user_id then return null; end if;            -- the trainer logged it themselves
  if exists (select 1 from public.dragonfly_push_tokens where user_id = tr and app = 'coach') then
    perform net.http_post(
      url := 'https://fkksaivdznqbfsfsagsj.supabase.co/functions/v1/dragonfly-push',
      headers := jsonb_build_object('content-type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cron_secret')),
      body := jsonb_build_object('action', 'workout_submitted', 'log_id', new.id),
      timeout_milliseconds := 10000);
  end if;
  return null;
end $$;
create trigger coach_log_push after insert on public.coach_logs for each row execute function public.coach_log_push();
revoke execute on function public.coach_log_push() from public, anon, authenticated;
