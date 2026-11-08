-- Slot waitlist: a client asks for a time that's taken ("Tuesdays at 7:00", or one date). When it opens, they're first
-- in line: 'auto_book' books them straight in (if the trainer lets clients book themselves); 'notify' sends them an
-- offer to take it right away. Waitlist order is first come, first served.
-- Cancellations are recorded in coach_open_slots (by trigger) so they're handled even when the trainer isn't in the
-- app (the coach-outbox job works through them).

create table public.coach_slot_waitlist (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  starts_at timestamptz,                       -- one date and time
  weekday smallint check (weekday between 0 and 6),   -- or every week (trainer's time zone), weekday 0 = Sunday
  start_time time,
  duration_min int not null default 60 check (duration_min in (30, 45, 60, 90)),
  mode text not null default 'notify' check (mode in ('notify', 'auto_book')),
  active boolean not null default true,
  filled_booking_id uuid references public.coach_bookings(id) on delete set null,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  check ((starts_at is not null and weekday is null and start_time is null) or (starts_at is null and weekday is not null and start_time is not null))
);
create index coach_slot_waitlist_trainer_idx on public.coach_slot_waitlist (trainer_id, active, created_at);

create function public.coach_slot_waitlist_fill() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select c.trainer_id into new.trainer_id from public.coach_clients c where c.id = new.client_id;
  if new.trainer_id is null then raise exception 'no_such_client' using errcode = '42501'; end if;
  if tg_op = 'INSERT' and (select count(*) from public.coach_slot_waitlist w where w.client_id = new.client_id and w.active) >= 10 then
    raise exception 'waitlist_limit' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger coach_slot_waitlist_fill before insert or update of client_id on public.coach_slot_waitlist for each row execute function public.coach_slot_waitlist_fill();
revoke execute on function public.coach_slot_waitlist_fill() from public, anon, authenticated;

alter table public.coach_slot_waitlist enable row level security;
revoke all on public.coach_slot_waitlist from anon;
grant select, insert, update, delete on public.coach_slot_waitlist to authenticated;
-- The client manages their own entries; the trainer sees their clients' entries and can remove or close them
create policy coach_slot_waitlist_rw on public.coach_slot_waitlist for all to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id))
  with check (public.coach_is_client(client_id) or public.coach_owns_client(client_id));

-- Who is waiting for this time, in line order (as the caller can see them)
create function public.coach_waitlist_for(p_trainer uuid, p_starts timestamptz, p_minutes int)
returns table (id uuid, client_id uuid, mode text, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select w.id, w.client_id, w.mode, w.created_at
  from public.coach_slot_waitlist w join public.coach_trainers t on t.user_id = w.trainer_id
  where w.trainer_id = p_trainer and w.active and w.duration_min <= p_minutes
    and ((w.starts_at = p_starts)
      or (w.weekday = extract(dow from p_starts at time zone t.timezone) and w.start_time = (p_starts at time zone t.timezone)::time))
  order by w.created_at
$$;
grant execute on function public.coach_waitlist_for(uuid, timestamptz, int) to authenticated, service_role;

-- Times that opened up (cancellations), waiting to be offered to the waitlist
create table public.coach_open_slots (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  starts_at timestamptz not null,
  duration_min int not null,
  source_booking_id uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  result text check (char_length(result) <= 200),
  unique (trainer_id, starts_at)
);
alter table public.coach_open_slots enable row level security;
revoke all on public.coach_open_slots from anon;
grant select on public.coach_open_slots to authenticated;
create policy coach_open_slots_trainer on public.coach_open_slots for select to authenticated using (trainer_id = (select auth.uid()));

-- A future client session was cancelled (one date skipped, or a one-off removed): note the open time
create function public.coach_booking_opened() returns trigger language plpgsql security definer set search_path = '' as $$
declare tz text; d date; s timestamptz;
begin
  if coalesce(old.client_id, old.group_id) is null or old.kind not in ('session', 'consult') then return null; end if;
  select timezone into tz from public.coach_trainers where user_id = old.trainer_id;
  tz := coalesce(tz, 'UTC');
  if tg_op = 'DELETE' then
    if old.repeat = 'none' and old.starts_at > now() then
      insert into public.coach_open_slots (trainer_id, starts_at, duration_min, source_booking_id) values (old.trainer_id, old.starts_at, old.duration_min, old.id)
        on conflict (trainer_id, starts_at) do nothing;
    end if;
    return null;
  end if;
  for d in select x from unnest(new.skipped) x where not (x = any (old.skipped)) loop
    s := ((d + (old.starts_at at time zone tz)::time) at time zone tz);
    if s > now() then
      insert into public.coach_open_slots (trainer_id, starts_at, duration_min, source_booking_id) values (old.trainer_id, s, old.duration_min, old.id)
        on conflict (trainer_id, starts_at) do nothing;
    end if;
  end loop;
  return null;
end $$;
create trigger coach_booking_opened after update of skipped or delete on public.coach_bookings for each row execute function public.coach_booking_opened();
revoke execute on function public.coach_booking_opened() from public, anon, authenticated;

-- Book a waitlisted client into an open time (server, or the trainer from the app). Checks the time is still free.
create function public.coach_waitlist_book(p_entry uuid, p_starts timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare w public.coach_slot_waitlist%rowtype; nm text; v uuid; tz text;
begin
  select * into w from public.coach_slot_waitlist where id = p_entry and active for update;
  if not found then raise exception 'not_waiting' using errcode = 'P0002'; end if;
  if auth.uid() is not null and not public.coach_owns_client(w.client_id) then raise exception 'not_your_client' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext(w.trainer_id::text));
  select coalesce(timezone, 'UTC') into tz from public.coach_trainers where user_id = w.trainer_id;
  if p_starts < now() or exists (select 1 from public.coach_bookings b where b.trainer_id = w.trainer_id
               and public.coach_booking_on(b, (p_starts at time zone tz)::date, tz) && tstzrange(p_starts, p_starts + make_interval(mins => w.duration_min))) then
    raise exception 'slot_taken' using errcode = '22023';
  end if;
  select first_name into nm from public.coach_clients where id = w.client_id;
  insert into public.coach_bookings (trainer_id, client_id, title, kind, starts_at, duration_min, booked_by)
    values (w.trainer_id, w.client_id, 'Session with ' || nm, 'session', p_starts, w.duration_min, 'client') returning id into v;
  update public.coach_slot_waitlist set active = (starts_at is null), filled_booking_id = v, last_notified_at = now() where id = w.id;
  return v;
end $$;
revoke execute on function public.coach_waitlist_book(uuid, timestamptz) from public, anon;
grant execute on function public.coach_waitlist_book(uuid, timestamptz) to authenticated, service_role;
