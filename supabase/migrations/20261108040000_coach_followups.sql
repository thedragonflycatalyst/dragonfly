-- Follow-ups that stay until the trainer says they're done (owner 2026-11-07): when a session moves, the trainer has to
-- make the same change in their outside calendar ("if we forget to put the change in club auto we're cooked"). Created
-- for every trainer with an outside calendar linked (ClubAutomation, Outlook, Google, …); trainers who only use the app
-- get none. A phone alert goes out at once and repeats every hour (8 AM–9 PM,
-- the trainer's time) until it's marked done; the app shows a red bar on every screen until then.
create table public.coach_followups (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  client_id uuid references public.coach_clients(id) on delete set null,
  booking_id uuid references public.coach_bookings(id) on delete set null,
  kind text not null default 'calendar_move' check (kind in ('calendar_move', 'calendar_cancel')),
  calendars text check (char_length(calendars) <= 200),    -- which outside calendars to update
  title text not null check (char_length(title) between 1 and 300),
  old_start timestamptz,
  new_start timestamptz,
  status text not null default 'open' check (status in ('open', 'done')),
  alerts int not null default 0,
  last_alert_at timestamptz,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index coach_followups_open_idx on public.coach_followups (trainer_id, status, created_at);
alter table public.coach_followups enable row level security;
revoke all on public.coach_followups from anon;
grant select on public.coach_followups to authenticated;
create policy coach_followups_own on public.coach_followups for select to authenticated using (trainer_id = (select auth.uid()));

create function public.coach_followup_move(p_trainer uuid, p_client uuid, p_booking uuid, p_old timestamptz, p_new timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare tz text; nm text; cals text; f text := 'Dy, Mon FMDD FMHH12:MI AM';
begin
  select string_agg(distinct label, ' and ' order by label) into cals from public.coach_calendar_feeds where trainer_id = p_trainer;
  if cals is null then return; end if;
  select coalesce(timezone, 'America/New_York') into tz from public.coach_trainers where user_id = p_trainer;
  select name into nm from public.coach_clients where id = p_client;
  insert into public.coach_followups (trainer_id, client_id, booking_id, calendars, title, old_start, new_start)
  values (p_trainer, p_client, p_booking, cals,
          'Reschedule ' || coalesce(nm, 'client') || ' in ' || cals || ' from ' || to_char(p_old at time zone tz, f) || ' to ' || to_char(p_new at time zone tz, f),
          p_old, p_new);
end $$;
revoke execute on function public.coach_followup_move(uuid, uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;

create function public.coach_followup_cancel(p_trainer uuid, p_client uuid, p_start timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare tz text; nm text; cals text;
begin
  select string_agg(distinct label, ' and ' order by label) into cals from public.coach_calendar_feeds where trainer_id = p_trainer;
  if cals is null then return; end if;
  select coalesce(timezone, 'America/New_York') into tz from public.coach_trainers where user_id = p_trainer;
  select name into nm from public.coach_clients where id = p_client;
  insert into public.coach_followups (trainer_id, client_id, kind, calendars, title, old_start)
  values (p_trainer, p_client, 'calendar_cancel', cals,
          'Cancel ' || coalesce(nm, 'client') || '''s session in ' || cals || ' on ' || to_char(p_start at time zone tz, 'Dy, Mon FMDD FMHH12:MI AM'), p_start);
end $$;
revoke execute on function public.coach_followup_cancel(uuid, uuid, timestamptz) from public, anon, authenticated;

-- Any change to an upcoming client session, however it was made (client request, trainer's calendar, text reply):
-- moved one-offs and cancelled dates become follow-ups. Moves made by coach_reschedule_session on a repeating
-- booking skip the date, so cancels are not added while coach.rescheduling is on (the move follow-up covers it).
create function public.coach_booking_followups() returns trigger language plpgsql security definer set search_path = '' as $$
declare tz text; d date; r tstzrange; moving boolean := coalesce(current_setting('coach.rescheduling', true) = 'on', false);
begin
  if coalesce(old.client_id, new.client_id) is null or coalesce(old.kind, new.kind) not in ('session', 'consult') then return null; end if;
  if tg_op = 'DELETE' then
    if not moving and old.repeat = 'none' and old.starts_at > now() then perform public.coach_followup_cancel(old.trainer_id, old.client_id, old.starts_at); end if;
    return null;
  end if;
  if new.repeat = 'none' and new.starts_at is distinct from old.starts_at and old.starts_at > now() then
    perform public.coach_followup_move(new.trainer_id, new.client_id, new.id, old.starts_at, new.starts_at);
  end if;
  if not moving then
    select coalesce(timezone, 'UTC') into tz from public.coach_trainers where user_id = new.trainer_id;
    for d in select x from unnest(new.skipped) x where not (x = any (old.skipped)) loop
      r := public.coach_booking_on(old, d, tz);
      if r is not null and lower(r) > now() then perform public.coach_followup_cancel(new.trainer_id, new.client_id, lower(r)); end if;
    end loop;
  end if;
  return null;
end $$;
create trigger coach_booking_followups after update of starts_at, skipped or delete on public.coach_bookings for each row execute function public.coach_booking_followups();
revoke execute on function public.coach_booking_followups() from public, anon, authenticated;

create function public.coach_followup_done(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.coach_followups set status = 'done', done_at = now() where id = p_id and trainer_id = auth.uid() and status = 'open';
  if not found then raise exception 'not_open' using errcode = '22023'; end if;
end $$;
revoke execute on function public.coach_followup_done(uuid) from public, anon;
grant execute on function public.coach_followup_done(uuid) to authenticated;

-- Phone alert right away (repeats come from coach-outbox every 15 minutes, at most hourly)
create function public.coach_followup_push() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.coach_push_tokens where user_id = new.trainer_id) then
    perform net.http_post(
      url := 'https://fkksaivdznqbfsfsagsj.supabase.co/functions/v1/coach-push',
      headers := jsonb_build_object('content-type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cron_secret')),
      body := jsonb_build_object('action', 'followup', 'followup_id', new.id),
      timeout_milliseconds := 10000);
  end if;
  return null;
end $$;
create trigger coach_followup_push after insert on public.coach_followups for each row execute function public.coach_followup_push();
revoke execute on function public.coach_followup_push() from public, anon, authenticated;
