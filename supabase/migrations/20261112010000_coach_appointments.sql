-- Client appointments (issue #56, owner 2026-11-11/12):
--  1. A client's move to another open time happens at once (owner 2026-11-12: "If it's inside available timeslots go
--     ahead and let it move on its own"). Within 24 hours of the session it can only move to another time the same day.
--     The trainer is told (push, and a text when texting is on). Old pending requests can still be decided.
--  2. Cancelling in the app inside the notice period is allowed and counts as a session (late cancellation), the same
--     as cancelling by text. Exactly at the cutoff counts as late.
--  3. Every client booking, move and cancellation is written to coach_appointment_log (who, what, when) so the client
--     and the trainer can see the history.

-- ------------------------------------------------------------ history
create table public.coach_appointment_log (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  booking_id uuid references public.coach_bookings(id) on delete set null,
  action text not null check (action in ('booked', 'moved', 'cancelled', 'late_cancelled')),
  via text not null check (via in ('app', 'text', 'trainer')),
  old_start timestamptz,
  new_start timestamptz,
  created_at timestamptz not null default now()
);
create index coach_appointment_log_client_idx on public.coach_appointment_log (client_id, created_at desc);
create index coach_appointment_log_trainer_idx on public.coach_appointment_log (trainer_id, created_at desc);
alter table public.coach_appointment_log enable row level security;
revoke all on public.coach_appointment_log from anon;
grant select on public.coach_appointment_log to authenticated;
create policy coach_appointment_log_read on public.coach_appointment_log for select to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id));

-- A client booking themselves in
create function public.coach_log_client_booking() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.booked_by = 'client' and new.client_id is not null and current_setting('coach.rescheduling', true) is distinct from 'on' then
    insert into public.coach_appointment_log (trainer_id, client_id, booking_id, action, via, new_start)
    values (new.trainer_id, new.client_id, new.id, 'booked', 'app', new.starts_at);
  end if;
  return null;
end $$;
create trigger coach_log_client_booking after insert on public.coach_bookings for each row execute function public.coach_log_client_booking();
revoke execute on function public.coach_log_client_booking() from public, anon, authenticated;

-- ------------------------------------------------------------ cancelling (app and text share one rule)
-- Late when the session starts within the notice period, or exactly at it. Returns {status, starts_at, late_hours}.
create function public.coach_cancel_occurrence(p_booking uuid, p_on date, p_via text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.coach_bookings%rowtype; hrs int; tz text; r tstzrange; late boolean;
begin
  select * into b from public.coach_bookings where id = p_booking for update;
  if not found then return jsonb_build_object('status', 'no_session'); end if;
  select coalesce(cancel_hours, 24), coalesce(timezone, 'UTC') into hrs, tz from public.coach_trainers where user_id = b.trainer_id;
  r := public.coach_booking_on(b, p_on, tz);
  if r is null or lower(r) <= now() then return jsonb_build_object('status', 'no_session'); end if;
  late := lower(r) <= now() + make_interval(hours => hrs);
  if late then
    perform set_config('coach.late_cancel', 'on', true);
    update public.coach_session_charges set note = 'Late cancellation (counts as a session)' where booking_id = b.id and on_date = p_on;
  end if;
  if b.repeat = 'none' and b.booked_by = 'client' then delete from public.coach_bookings where id = b.id;
  else update public.coach_bookings set skipped = array_append(skipped, p_on) where id = b.id and not (p_on = any (skipped)); end if;
  perform set_config('coach.late_cancel', 'off', true);
  insert into public.coach_appointment_log (trainer_id, client_id, booking_id, action, via, old_start)
  values (b.trainer_id, b.client_id, case when b.repeat = 'none' and b.booked_by = 'client' then null else b.id end,
          case when late then 'late_cancelled' else 'cancelled' end, p_via, lower(r));
  return jsonb_build_object('status', case when late then 'late_cancelled' else 'cancelled' end, 'starts_at', lower(r), 'late_hours', hrs);
end $$;
revoke execute on function public.coach_cancel_occurrence(uuid, date, text) from public, anon, authenticated;

-- In the app. Inside the notice period it's still cancelled, and counts as a session.
drop function public.coach_cancel_session(uuid, date);
create function public.coach_cancel_session(p_booking uuid, p_on date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.coach_bookings%rowtype; res jsonb;
begin
  select * into b from public.coach_bookings where id = p_booking;
  if not found or b.client_id is null or not public.coach_is_client(b.client_id) then raise exception 'not your session' using errcode = '42501'; end if;
  if not public.coach_perm(b.trainer_id, 'cancel_sessions') then raise exception 'cancel_closed' using errcode = '42501'; end if;
  res := public.coach_cancel_occurrence(p_booking, p_on, 'app');
  if res->>'status' = 'no_session' then raise exception 'no session that day' using errcode = '22023'; end if;
  return res;
end $$;
revoke execute on function public.coach_cancel_session(uuid, date) from public, anon;
grant execute on function public.coach_cancel_session(uuid, date) to authenticated;

-- By text (CANCEL APPOINTMENT): same rule; the client is identified by the server from their phone number
create or replace function public.coach_cancel_by_text(p_booking uuid, p_on date, p_client uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.coach_bookings%rowtype; tz text; r tstzrange;
begin
  select * into b from public.coach_bookings where id = p_booking and client_id = p_client;
  if not found then return jsonb_build_object('status', 'no_session'); end if;
  if not public.coach_perm(b.trainer_id, 'cancel_sessions') then
    select coalesce(timezone, 'UTC') into tz from public.coach_trainers where user_id = b.trainer_id;
    r := public.coach_booking_on(b, p_on, tz);
    if r is null or lower(r) <= now() then return jsonb_build_object('status', 'no_session'); end if;
    return jsonb_build_object('status', 'not_allowed', 'starts_at', lower(r));
  end if;
  return public.coach_cancel_occurrence(p_booking, p_on, 'text');
end $$;

-- ------------------------------------------------------------ moving
alter table public.coach_reschedule_requests drop constraint coach_reschedule_requests_status_check;
alter table public.coach_reschedule_requests add constraint coach_reschedule_requests_status_check
  check (status in ('pending', 'approved', 'declined', 'expired', 'withdrawn', 'moved'));   -- moved: the client moved it into an open time

create or replace function public.coach_reschedule_session(p_booking uuid, p_on date, p_new timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare b public.coach_bookings%rowtype; tz text; r tstzrange; want tstzrange; loc timestamp; is_client boolean; v uuid; nd date;
begin
  select * into b from public.coach_bookings where id = p_booking for update;
  if not found or b.client_id is null then raise exception 'not_your_session' using errcode = '42501'; end if;
  is_client := public.coach_is_client(b.client_id);
  if not is_client and not public.coach_owns_client(b.client_id) then raise exception 'not_your_session' using errcode = '42501'; end if;
  if is_client and not public.coach_perm(b.trainer_id, 'book_sessions') then raise exception 'booking_closed' using errcode = '42501'; end if;
  select coalesce(timezone, 'UTC') into tz from public.coach_trainers where user_id = b.trainer_id;
  r := public.coach_booking_on(b, p_on, tz);
  if r is null then raise exception 'no session that day' using errcode = '22023'; end if;
  if lower(r) <= now() then raise exception 'already_started' using errcode = '22023'; end if;
  loc := p_new at time zone tz; nd := loc::date;
  -- Within 24 hours (exactly 24 included): another time on the session's own calendar day only
  if lower(r) <= now() + interval '24 hours' and nd <> p_on then raise exception 'same_day_only' using errcode = '22023'; end if;
  if p_new < now() + interval '1 hour' or p_new > now() + interval '120 days' then raise exception 'bad_time' using errcode = '22023'; end if;
  if p_new = lower(r) then return b.id; end if;
  if is_client and not exists (select 1 from public.coach_availability a where a.trainer_id = b.trainer_id and a.weekday = extract(dow from loc)
                  -- compared in seconds so a session running past midnight can't wrap around to "early morning"
                  and a.start_time <= loc::time and extract(epoch from loc::time) + b.duration_min * 60 <= extract(epoch from a.end_time)) then
    raise exception 'outside_hours' using errcode = '22023';
  end if;
  want := tstzrange(p_new, p_new + make_interval(mins => b.duration_min));
  perform pg_advisory_xact_lock(hashtext(b.trainer_id::text));
  if exists (select 1 from public.coach_bookings x where x.trainer_id = b.trainer_id and not (x.id = b.id and nd = p_on)
               and public.coach_booking_on(x, nd, tz) && want)
     or exists (select 1 from public.coach_events e where e.trainer_id = b.trainer_id and not e.cancelled
                 and tstzrange(e.starts_at, e.starts_at + make_interval(mins => e.duration_min)) && want)
     or exists (select 1 from public.coach_external_busy x where x.trainer_id = b.trainer_id and tstzrange(x.starts_at, x.ends_at) && want) then
    raise exception 'slot_taken' using errcode = '22023';
  end if;
  -- One transaction: the old time is only released if the new one is booked
  perform set_config('coach.rescheduling', 'on', true);
  if b.repeat = 'none' then
    update public.coach_bookings set starts_at = p_new where id = b.id;
    insert into public.coach_open_slots (trainer_id, starts_at, duration_min, source_booking_id) values (b.trainer_id, lower(r), b.duration_min, b.id)
      on conflict (trainer_id, starts_at) do nothing;
    v := b.id;
  else
    -- Skipping the date frees the old time (waitlist) and releases its payment; the new one-off picks it back up
    update public.coach_bookings set skipped = array_append(skipped, p_on) where id = b.id;
    insert into public.coach_bookings (trainer_id, client_id, title, kind, location, starts_at, duration_min, notes, color, booked_by)
    values (b.trainer_id, b.client_id, b.title, b.kind, b.location, p_new, b.duration_min, b.notes, b.color, b.booked_by) returning id into v;
  end if;
  perform set_config('coach.rescheduling', 'off', true);
  if b.repeat <> 'none' then perform public.coach_followup_move(b.trainer_id, b.client_id, b.id, lower(r), p_new); end if;
  insert into public.coach_appointment_log (trainer_id, client_id, booking_id, action, via, old_start, new_start)
  values (b.trainer_id, b.client_id, v, 'moved', case when is_client then 'app' else 'trainer' end, lower(r), p_new);
  -- A client's move: the trainer hears about it (push now; a text from coach-outbox when texting is on)
  if is_client then
    update public.coach_reschedule_requests set status = 'withdrawn', decided_at = now() where booking_id = b.id and on_date = p_on and status = 'pending';
    insert into public.coach_reschedule_requests (booking_id, on_date, client_id, trainer_id, old_start, new_start, duration_min, status, new_booking_id, decided_at, client_told_at)
    values (b.id, p_on, b.client_id, b.trainer_id, lower(r), p_new, b.duration_min, 'moved', v, now(), now());
  end if;
  return v;
end $$;

-- Deciding an old pending request still moves it (as the trainer); the history shows the trainer moved it
