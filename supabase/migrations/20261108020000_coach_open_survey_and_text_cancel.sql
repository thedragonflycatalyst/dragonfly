-- Owner requests, 2026-11-07:
--  1. A survey the trainer can hand out any time: one link and QR code per trainer (e.g. shown at the end of a class).
--     Signed-in clients are recorded as themselves; anyone else answers anonymously (optional first name).
--  2. Text replies in whole words: CONFIRM, RESCHEDULE, CANCEL SESSION. A cancel by text follows the trainer's notice
--     period (cancel_hours) and the "clients may cancel" setting, exactly like cancelling in the app.

-- ------------------------------------------------------------ open survey
alter table public.coach_survey_responses
  alter column outbox_id drop not null,
  alter column client_id drop not null,
  add column source text not null default 'ask' check (source in ('ask', 'open')),
  add column name text check (char_length(name) <= 60);
alter table public.coach_survey_responses add constraint coach_survey_responses_who check (source = 'open' or (outbox_id is not null and client_id is not null));

create table public.coach_survey_links (
  trainer_id uuid primary key references public.coach_trainers(user_id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{8}$'),
  question text not null default 'How was your training today?' check (char_length(question) between 5 and 200),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.coach_survey_links enable row level security;
revoke all on public.coach_survey_links from anon;
grant select, update on public.coach_survey_links to authenticated;
create policy coach_survey_links_own on public.coach_survey_links for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
-- The code itself is only changed through coach_survey_link(true)
create function public.coach_survey_link_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and new.code <> old.code and current_setting('coach.survey_code', true) is distinct from 'on' then
    raise exception 'use_new_link' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger coach_survey_link_guard before update on public.coach_survey_links for each row execute function public.coach_survey_link_guard();
revoke execute on function public.coach_survey_link_guard() from public, anon, authenticated;

-- The signed-in trainer's survey code (made the first time); p_new = true replaces it (old QR codes stop working)
create function public.coach_survey_link(p_new boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c text;
begin
  if me is null or not exists (select 1 from public.coach_trainers where user_id = me) then raise exception 'trainers_only' using errcode = '42501'; end if;
  select code into c from public.coach_survey_links where trainer_id = me;
  if c is not null and not p_new then return c; end if;
  loop
    c := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    exit when not exists (select 1 from public.coach_survey_links where code = c);
  end loop;
  perform set_config('coach.survey_code', 'on', true);
  insert into public.coach_survey_links (trainer_id, code) values (me, c)
    on conflict (trainer_id) do update set code = excluded.code, active = true;
  return c;
end $$;
revoke execute on function public.coach_survey_link(boolean) from public, anon;
grant execute on function public.coach_survey_link(boolean) to authenticated;

create function public.coach_open_survey_view(p_code text) returns table (trainer_name text, question text, client_first text)
language sql stable security definer set search_path = '' as $$
  select t.display_name, l.question,
         (select c.first_name from public.coach_clients c where c.trainer_id = l.trainer_id and c.user_id = auth.uid() and c.status = 'active' limit 1)
  from public.coach_survey_links l join public.coach_trainers t on t.user_id = l.trainer_id
  where l.code = lower(p_code) and l.active
$$;
revoke execute on function public.coach_open_survey_view(text) from public;
grant execute on function public.coach_open_survey_view(text) to anon, authenticated;

-- One answer per signed-in client per day (a second answer updates it); anonymous answers are capped per trainer per day
create function public.coach_open_survey_answer(p_code text, p_rating int, p_comment text, p_name text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare l public.coach_survey_links%rowtype; cid uuid; existing uuid;
begin
  select * into l from public.coach_survey_links where code = lower(p_code) and active;
  if not found then raise exception 'bad_link' using errcode = 'P0002'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'rating_1_to_5' using errcode = '22023'; end if;
  cid := public.coach_my_client_id(l.trainer_id);
  if cid is not null then
    select id into existing from public.coach_survey_responses
     where client_id = cid and source = 'open' and created_at >= date_trunc('day', now()) limit 1;
    if existing is not null then
      update public.coach_survey_responses set rating = p_rating, comment = nullif(left(trim(coalesce(p_comment, '')), 1000), ''), updated_at = now() where id = existing;
      return 'updated';
    end if;
  elsif (select count(*) from public.coach_survey_responses where trainer_id = l.trainer_id and source = 'open' and client_id is null and created_at >= now() - interval '1 day') >= 300 then
    raise exception 'try_later' using errcode = '22023';
  end if;
  insert into public.coach_survey_responses (client_id, trainer_id, rating, comment, source, name)
  values (cid, l.trainer_id, p_rating, nullif(left(trim(coalesce(p_comment, '')), 1000), ''), 'open',
          case when cid is null then nullif(left(trim(coalesce(p_name, '')), 60), '') end);
  return 'saved';
end $$;
revoke execute on function public.coach_open_survey_answer(text, int, text, text) from public;
grant execute on function public.coach_open_survey_answer(text, int, text, text) to anon, authenticated;

-- ------------------------------------------------------------ cancel by text (server only)
-- CANCEL APPOINTMENT: the session must happen that day and the trainer must let clients cancel. With enough notice
-- (cancel_hours) it's a normal cancellation. With less, it's a late cancellation (owner 2026-11-07): the session is
-- still cancelled, so the time goes to the waitlist, but whatever paid for it is kept (it counts as a session).
-- Returns {status: cancelled | late_cancelled | not_allowed | no_session, starts_at}.
create function public.coach_cancel_by_text(p_booking uuid, p_on date, p_client uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.coach_bookings%rowtype; hrs int; tz text; r tstzrange; late boolean;
begin
  select * into b from public.coach_bookings where id = p_booking and client_id = p_client for update;
  if not found then return jsonb_build_object('status', 'no_session'); end if;
  select cancel_hours, coalesce(timezone, 'UTC') into hrs, tz from public.coach_trainers where user_id = b.trainer_id;
  r := public.coach_booking_on(b, p_on, tz);
  if r is null or lower(r) <= now() then return jsonb_build_object('status', 'no_session'); end if;
  if not public.coach_perm(b.trainer_id, 'cancel_sessions') then return jsonb_build_object('status', 'not_allowed', 'starts_at', lower(r)); end if;
  late := lower(r) < now() + make_interval(hours => coalesce(hrs, 24));
  if late then
    perform set_config('coach.late_cancel', 'on', true);
    update public.coach_session_charges set note = 'Late cancellation (counts as a session)' where booking_id = b.id and on_date = p_on;
  end if;
  if b.repeat = 'none' and b.booked_by = 'client' then delete from public.coach_bookings where id = b.id;
  else update public.coach_bookings set skipped = array_append(skipped, p_on) where id = b.id and not (p_on = any (skipped)); end if;
  perform set_config('coach.late_cancel', 'off', true);
  return jsonb_build_object('status', case when late then 'late_cancelled' else 'cancelled' end, 'starts_at', lower(r));
end $$;
revoke execute on function public.coach_cancel_by_text(uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.coach_cancel_by_text(uuid, date, uuid) to service_role;

-- Review sites for the open survey page (same list as coach_review_links_for)
create function public.coach_review_links_for_survey(p_code text) returns table (platform text, label text, url text)
language sql stable security definer set search_path = '' as $$
  select r.platform, coalesce(r.label, initcap(r.platform)), r.url
  from public.coach_survey_links l join public.coach_review_links r on r.trainer_id = l.trainer_id
  where l.code = lower(p_code) and l.active and r.active
  order by r.sort, r.created_at
$$;
revoke execute on function public.coach_review_links_for_survey(text) from public;
grant execute on function public.coach_review_links_for_survey(text) to anon, authenticated;

-- A late cancellation keeps what paid for the session: the charge release trigger skips it
create or replace function public.coach_booking_charges() returns trigger language plpgsql security definer set search_path = '' as $$
declare tz text; d date; c uuid; keep boolean := coalesce(current_setting('coach.late_cancel', true) = 'on', false);
begin
  if tg_op = 'DELETE' then
    if not keep then
      for c in select id from public.coach_session_charges where booking_id = old.id and status in ('package', 'pending', 'paid') and starts_at > now() loop
        perform public.coach_charge_release(c);
      end loop;
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then perform public.coach_charge_attach_booking(new.id); return null; end if;
  if not keep then
    for d in select x from unnest(new.skipped) x where not (x = any (old.skipped)) loop
      for c in select id from public.coach_session_charges where booking_id = new.id and on_date = d and status in ('package', 'pending', 'paid') loop
        perform public.coach_charge_release(c);
      end loop;
    end loop;
  end if;
  if new.repeat = 'none' and new.starts_at is distinct from old.starts_at then
    select coalesce(timezone, 'UTC') into tz from public.coach_trainers where user_id = new.trainer_id;
    update public.coach_session_charges set starts_at = new.starts_at, on_date = (new.starts_at at time zone tz)::date
     where booking_id = new.id and status in ('package', 'pending', 'paid');
  end if;
  return null;
end $$;

-- New trainers start with a 24-hour cancellation notice (existing trainers keep their setting)
alter table public.coach_trainers alter column cancel_hours set default 24;
