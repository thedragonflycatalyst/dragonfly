-- Dragonfly (coaching): packages, vouchers, payments, client credits, the calendar and events.
--
-- Packages are what a trainer sells (session packs, memberships, programs). Buying one, or the trainer giving one
-- out, creates a coach_client_packages row holding the client's credits. Events (classes, workshops) can cost money,
-- credits from a package, or be free; they have spaces and an optional waiting list. Calendar bookings are the
-- trainer's sessions, optionally repeating, and clients can book themselves into the trainer's open hours.
-- Stripe payments are written by the coach-pay edge function (service role); trainers record cash and other payments.

-- ---------------------------------------------------------------- packages and vouchers

create table public.coach_packages (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 4000),
  cover text check (char_length(cover) <= 300),
  price_cents int not null default 0 check (price_cents between 0 and 10000000),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  billing text not null default 'once' check (billing in ('once', 'week', 'month', 'year')),
  credits int check (credits between 1 and 1000),          -- sessions or class credits (each billing period when recurring)
  valid_days int check (valid_days between 1 and 3650),     -- credits expire this many days after purchase
  program_ids uuid[] not null default '{}',                 -- included: programs assigned on purchase
  plan_ids uuid[] not null default '{}',                    -- included: nutrition plans shared on purchase
  visible boolean not null default true,                    -- clients can see and buy it in their app
  client_ids uuid[] not null default '{}',                  -- only these clients can see it (empty = all)
  available_from date, available_until date,
  max_sales int check (max_sales between 1 and 100000),
  sold int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (available_until is null or available_from is null or available_until >= available_from)
);
create index coach_packages_trainer_idx on public.coach_packages (trainer_id) where not archived;
create trigger coach_packages_touch before update on public.coach_packages for each row execute function public.coach_touch();

create table public.coach_vouchers (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_-]{3,30}$'),
  description text check (char_length(description) <= 500),
  percent_off int check (percent_off between 1 and 100),
  amount_off_cents int check (amount_off_cents between 1 and 10000000),
  package_ids uuid[] not null default '{}',                 -- works on these packages (empty = all)
  max_uses int check (max_uses between 1 and 100000),
  uses int not null default 0,
  expires_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (trainer_id, code),
  check ((percent_off is null) <> (amount_off_cents is null))
);

-- ---------------------------------------------------------------- payments and client credits

create table public.coach_payments (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  client_id uuid references public.coach_clients(id) on delete set null,
  package_id uuid references public.coach_packages(id) on delete set null,
  event_id uuid,
  description text not null check (char_length(description) between 1 and 200),
  amount_cents int not null check (amount_cents between 0 and 10000000),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  status text not null default 'paid' check (status in ('paid', 'pending', 'refunded', 'failed')),
  method text not null default 'cash' check (method in ('stripe', 'cash', 'card', 'transfer', 'other')),
  stripe_session_id text unique,
  stripe_payment_intent text,
  stripe_subscription_id text,
  voucher_id uuid references public.coach_vouchers(id) on delete set null,
  note text check (char_length(note) <= 1000),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index coach_payments_trainer_idx on public.coach_payments (trainer_id, paid_at desc);

create table public.coach_client_packages (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  package_id uuid references public.coach_packages(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  credits_total int check (credits_total between 1 and 100000),
  credits_used int not null default 0 check (credits_used >= 0),
  starts_on date not null default current_date,
  expires_on date,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  billing text not null default 'once' check (billing in ('once', 'week', 'month', 'year')),
  payment_id uuid references public.coach_payments(id) on delete set null,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  check (credits_total is null or credits_used <= credits_total)
);
create index coach_client_packages_client_idx on public.coach_client_packages (client_id, status);
create trigger coach_client_packages_guard before insert or update on public.coach_client_packages for each row execute function public.coach_child_guard();

-- Payments for a client must be the trainer's own client
create function public.coach_payment_guard() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if new.client_id is not null and not exists (select 1 from public.coach_clients c where c.id = new.client_id and c.trainer_id = new.trainer_id) then
    raise exception 'client does not belong to this trainer' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger coach_payments_guard before insert or update on public.coach_payments for each row execute function public.coach_payment_guard();

-- Uses one credit (or p_n) from the client's soonest-expiring package that has enough left; returns that package
create function public.coach_use_credits(p_client uuid, p_n int) returns uuid
language plpgsql security definer set search_path = '' as
$$
declare v uuid;
begin
  select id into v from public.coach_client_packages
   where client_id = p_client and status = 'active' and credits_total is not null and credits_total - credits_used >= p_n
     and (expires_on is null or expires_on >= current_date) and starts_on <= current_date
   order by expires_on nulls last, created_at limit 1 for update;
  if v is not null then update public.coach_client_packages set credits_used = credits_used + p_n where id = v; end if;
  return v;
end
$$;

-- ---------------------------------------------------------------- calendar

-- The trainer's open hours for clients to book themselves in (weekday 0 = Sunday)
create table public.coach_availability (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index coach_availability_trainer_idx on public.coach_availability (trainer_id, weekday);

create table public.coach_bookings (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  client_id uuid references public.coach_clients(id) on delete cascade,
  group_id uuid references public.coach_groups(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'session' check (kind in ('session', 'consult', 'class', 'block', 'other')),
  location text check (char_length(location) <= 200),
  starts_at timestamptz not null,
  duration_min int not null default 60 check (duration_min between 5 and 720),
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly', 'biweekly', 'monthly')),
  repeat_until date,
  skipped date[] not null default '{}',                     -- occurrences cancelled (by local date)
  done date[] not null default '{}',                        -- occurrences that happened
  notes text check (char_length(notes) <= 2000),
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  booked_by text not null default 'trainer' check (booked_by in ('trainer', 'client')),
  created_at timestamptz not null default now(),
  check (client_id is null or group_id is null)
);
create index coach_bookings_trainer_idx on public.coach_bookings (trainer_id, starts_at);
create index coach_bookings_client_idx on public.coach_bookings (client_id);

create function public.coach_booking_guard() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if new.client_id is not null and not exists (select 1 from public.coach_clients c where c.id = new.client_id and c.trainer_id = new.trainer_id) then
    raise exception 'client does not belong to this trainer' using errcode = '42501';
  end if;
  if new.group_id is not null and not exists (select 1 from public.coach_groups g where g.id = new.group_id and g.trainer_id = new.trainer_id) then
    raise exception 'group does not belong to this trainer' using errcode = '42501';
  end if;
  -- A session marked done counts as the client's latest session (used by automatic freezing)
  if tg_op = 'UPDATE' and new.client_id is not null and cardinality(new.done) > cardinality(old.done) then
    update public.coach_clients set last_session_at = now() where id = new.client_id;
  end if;
  return new;
end
$$;
create trigger coach_bookings_guard before insert or update on public.coach_bookings for each row execute function public.coach_booking_guard();

-- ---------------------------------------------------------------- events

create table public.coach_events (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 4000),
  cover text check (char_length(cover) <= 300),
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  location text check (char_length(location) <= 200),
  starts_at timestamptz not null,
  duration_min int not null default 60 check (duration_min between 5 and 1440),
  spaces int check (spaces between 1 and 10000),           -- null = unlimited
  waitlist boolean not null default false,
  price_cents int check (price_cents between 1 and 10000000),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  credits int check (credits between 1 and 100),           -- credits from a package instead of paying
  visible boolean not null default true,
  cancelled boolean not null default false,
  booked int not null default 0,
  waiting int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_events_trainer_idx on public.coach_events (trainer_id, starts_at);
create trigger coach_events_touch before update on public.coach_events for each row execute function public.coach_touch();
alter table public.coach_payments add constraint coach_payments_event_fk foreign key (event_id) references public.coach_events(id) on delete set null;

create table public.coach_event_signups (
  event_id uuid not null references public.coach_events(id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  status text not null default 'booked' check (status in ('booked', 'waitlist', 'cancelled')),
  paid boolean not null default false,
  client_package_id uuid references public.coach_client_packages(id) on delete set null,
  attended boolean,
  created_at timestamptz not null default now(),
  primary key (event_id, client_id)
);
create trigger coach_event_signups_guard before insert or update on public.coach_event_signups for each row execute function public.coach_child_guard();

-- Keeps the booked / waiting counts on the event
create function public.coach_event_count() returns trigger
language plpgsql security definer set search_path = '' as
$$
declare e uuid := coalesce(new.event_id, old.event_id);
begin
  update public.coach_events set
    booked = (select count(*) from public.coach_event_signups where event_id = e and status = 'booked'),
    waiting = (select count(*) from public.coach_event_signups where event_id = e and status = 'waitlist')
   where id = e;
  return null;
end
$$;
create trigger coach_event_signups_count after insert or update or delete on public.coach_event_signups for each row execute function public.coach_event_count();

-- ---------------------------------------------------------------- client actions

-- Trainer settings for what clients may do themselves
alter table public.coach_trainers add column client_perms jsonb not null default
  '{"book_sessions": true, "cancel_sessions": true, "join_events": true, "edit_workouts": false, "log_food": true, "see_macros": true, "message_trainer": true, "join_communities": true}'::jsonb
  check (jsonb_typeof(client_perms) = 'object');
alter table public.coach_trainers add column cancel_hours int not null default 12 check (cancel_hours between 0 and 168);

create function public.coach_perm(p_trainer uuid, p_key text) returns boolean
language sql stable security definer set search_path = '' as
$$ select coalesce((select (t.client_perms ->> p_key)::boolean from public.coach_trainers t where t.user_id = p_trainer), true) $$;

-- The client's own active record with this trainer
create function public.coach_my_client_id(p_trainer uuid) returns uuid
language sql stable security definer set search_path = '' as
$$ select id from public.coach_clients where trainer_id = p_trainer and user_id = auth.uid() and status = 'active' limit 1 $$;

-- Client signs up for an event: uses credits if it needs them, joins the waiting list when full.
-- Returns 'booked', 'waitlist', 'pay' (it costs money: pay through coach-pay first) or 'already'.
create function public.coach_event_join(p_event uuid) returns text
language plpgsql security definer set search_path = '' as
$$
declare e public.coach_events%rowtype; c uuid; s public.coach_event_signups%rowtype; pk uuid;
begin
  select * into e from public.coach_events where id = p_event for update;
  if not found then raise exception 'event not found' using errcode = 'P0002'; end if;
  c := public.coach_my_client_id(e.trainer_id);
  if c is null or not e.visible then raise exception 'not your trainer''s event' using errcode = '42501'; end if;
  if not public.coach_perm(e.trainer_id, 'join_events') then raise exception 'events_closed' using errcode = '42501'; end if;
  if e.cancelled or e.starts_at < now() then raise exception 'event_closed' using errcode = '22023'; end if;
  select * into s from public.coach_event_signups where event_id = p_event and client_id = c;
  if found and s.status <> 'cancelled' then return 'already'; end if;
  if e.spaces is not null and e.booked >= e.spaces then
    if not e.waitlist then raise exception 'event_full' using errcode = '22023'; end if;
    insert into public.coach_event_signups (event_id, client_id, trainer_id, status) values (p_event, c, e.trainer_id, 'waitlist')
      on conflict (event_id, client_id) do update set status = 'waitlist', paid = false, client_package_id = null;
    return 'waitlist';
  end if;
  if e.credits is not null then
    pk := public.coach_use_credits(c, e.credits);
    if pk is null and e.price_cents is null then raise exception 'no_credits' using errcode = '22023'; end if;
  end if;
  if pk is null and e.price_cents is not null then return 'pay'; end if;
  insert into public.coach_event_signups (event_id, client_id, trainer_id, status, client_package_id) values (p_event, c, e.trainer_id, 'booked', pk)
    on conflict (event_id, client_id) do update set status = 'booked', client_package_id = pk;
  return 'booked';
end
$$;

-- Moves people up from the waiting list while there's room (using their credits when the event needs them)
create function public.coach_event_promote(p_event uuid) returns void
language plpgsql security definer set search_path = '' as
$$
declare e public.coach_events%rowtype; w record; pk uuid;
begin
  select * into e from public.coach_events where id = p_event for update;
  for w in select * from public.coach_event_signups where event_id = p_event and status = 'waitlist' order by created_at loop
    exit when e.spaces is not null and (select count(*) from public.coach_event_signups where event_id = p_event and status = 'booked') >= e.spaces;
    pk := null;
    if e.credits is not null then
      pk := public.coach_use_credits(w.client_id, e.credits);
      continue when pk is null;
    elsif e.price_cents is not null then
      continue;  -- paid events: they're told a space opened up and pay to take it
    end if;
    update public.coach_event_signups set status = 'booked', client_package_id = pk where event_id = p_event and client_id = w.client_id;
  end loop;
end
$$;

-- Client (or trainer) cancels a signup: credits go back, the next person on the waiting list moves up
create function public.coach_event_leave(p_event uuid, p_client uuid default null) returns void
language plpgsql security definer set search_path = '' as
$$
declare e public.coach_events%rowtype; c uuid; s public.coach_event_signups%rowtype;
begin
  select * into e from public.coach_events where id = p_event;
  if not found then raise exception 'event not found' using errcode = 'P0002'; end if;
  if p_client is not null and e.trainer_id = public.coach_acting_write() then c := p_client;
  else c := public.coach_my_client_id(e.trainer_id); end if;
  if c is null then raise exception 'not your event' using errcode = '42501'; end if;
  select * into s from public.coach_event_signups where event_id = p_event and client_id = c for update;
  if not found or s.status = 'cancelled' then return; end if;
  if s.client_package_id is not null then
    update public.coach_client_packages set credits_used = greatest(credits_used - coalesce(e.credits, 0), 0) where id = s.client_package_id;
  end if;
  update public.coach_event_signups set status = 'cancelled', client_package_id = null where event_id = p_event and client_id = c;
  perform public.coach_event_promote(p_event);
end
$$;

-- When a booking (one-off or repeating) happens on a local day, as a time range; null if it doesn't
create function public.coach_booking_on(b public.coach_bookings, p_day date, p_tz text) returns tstzrange
language plpgsql stable set search_path = '' as
$$
declare first_day date := (b.starts_at at time zone p_tz)::date; t time := (b.starts_at at time zone p_tz)::time; s timestamptz;
begin
  if p_day < first_day or p_day = any (b.skipped) or (b.repeat_until is not null and p_day > b.repeat_until) then return null; end if;
  if not (case b.repeat
      when 'none' then p_day = first_day
      when 'daily' then true
      when 'weekly' then (p_day - first_day) % 7 = 0
      when 'biweekly' then (p_day - first_day) % 14 = 0
      when 'monthly' then extract(day from p_day) = extract(day from first_day)
      else false end) then return null; end if;
  s := (p_day + t) at time zone p_tz;
  return tstzrange(s, s + make_interval(mins => b.duration_min));
end
$$;

-- Client booking screen: the trainer's busy times over the next days (no details about who or what)
create function public.coach_trainer_busy(p_trainer uuid, p_days int default 21) returns table (starts_at timestamptz, ends_at timestamptz)
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
end
$$;

-- Client books a session in the trainer's open hours (no overlap with the trainer's other bookings)
create function public.coach_book_session(p_trainer uuid, p_starts timestamptz, p_minutes int, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as
$$
declare c uuid := public.coach_my_client_id(p_trainer); v uuid; tz text; loc timestamp; nm text;
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
  perform pg_advisory_xact_lock(hashtext(p_trainer::text));
  if exists (select 1 from public.coach_bookings b where b.trainer_id = p_trainer
              and public.coach_booking_on(b, loc::date, coalesce(tz, 'UTC')) && tstzrange(p_starts, p_starts + make_interval(mins => p_minutes)))
     or exists (select 1 from public.coach_events e where e.trainer_id = p_trainer and not e.cancelled
              and tstzrange(e.starts_at, e.starts_at + make_interval(mins => e.duration_min)) && tstzrange(p_starts, p_starts + make_interval(mins => p_minutes))) then
    raise exception 'slot_taken' using errcode = '22023';
  end if;
  select first_name into nm from public.coach_clients where id = c;
  insert into public.coach_bookings (trainer_id, client_id, title, kind, starts_at, duration_min, notes, booked_by)
  values (p_trainer, c, 'Session with ' || nm, 'session', p_starts, p_minutes, nullif(left(p_note, 2000), ''), 'client') returning id into v;
  return v;
end
$$;

-- Client cancels one of their sessions (one-off, or one date of a repeating one) if it's far enough ahead
create function public.coach_cancel_session(p_booking uuid, p_on date) returns void
language plpgsql security definer set search_path = '' as
$$
declare b public.coach_bookings%rowtype; hrs int; tz text;
begin
  select * into b from public.coach_bookings where id = p_booking for update;
  if not found or not public.coach_is_client(b.client_id) then raise exception 'not your session' using errcode = '42501'; end if;
  if not public.coach_perm(b.trainer_id, 'cancel_sessions') then raise exception 'cancel_closed' using errcode = '42501'; end if;
  select cancel_hours, timezone into hrs, tz from public.coach_trainers where user_id = b.trainer_id;
  if (p_on + (b.starts_at at time zone coalesce(tz, 'UTC'))::time) at time zone coalesce(tz, 'UTC') < now() + make_interval(hours => hrs) then
    raise exception 'too_late_to_cancel' using errcode = '22023';
  end if;
  if b.repeat = 'none' and b.booked_by = 'client' then delete from public.coach_bookings where id = p_booking;
  else update public.coach_bookings set skipped = array_append(skipped, p_on) where id = p_booking and not (p_on = any (skipped)); end if;
end
$$;

-- Is the signed-in client in this group (for group sessions on their calendar)?
create function public.coach_in_my_group(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select p_group is not null and exists (select 1 from public.coach_group_members gm join public.coach_clients c on c.id = gm.client_id
                                           where gm.group_id = p_group and c.user_id = auth.uid() and c.status = 'active') $$;

-- ---------------------------------------------------------------- privileges and policies

revoke execute on function public.coach_payment_guard(), public.coach_booking_guard(), public.coach_event_count(),
  public.coach_use_credits(uuid, int), public.coach_event_promote(uuid) from public, anon, authenticated;
revoke execute on function public.coach_trainer_busy(uuid, int), public.coach_in_my_group(uuid), public.coach_perm(uuid, text), public.coach_my_client_id(uuid), public.coach_event_join(uuid),
  public.coach_event_leave(uuid, uuid), public.coach_book_session(uuid, timestamptz, int, text), public.coach_cancel_session(uuid, date) from public, anon;
grant execute on function public.coach_trainer_busy(uuid, int), public.coach_in_my_group(uuid), public.coach_perm(uuid, text), public.coach_my_client_id(uuid), public.coach_event_join(uuid),
  public.coach_event_leave(uuid, uuid), public.coach_book_session(uuid, timestamptz, int, text), public.coach_cancel_session(uuid, date) to authenticated;

alter table public.coach_packages enable row level security;
alter table public.coach_vouchers enable row level security;
alter table public.coach_payments enable row level security;
alter table public.coach_client_packages enable row level security;
alter table public.coach_availability enable row level security;
alter table public.coach_bookings enable row level security;
alter table public.coach_events enable row level security;
alter table public.coach_event_signups enable row level security;
revoke all on public.coach_packages, public.coach_vouchers, public.coach_payments, public.coach_client_packages,
  public.coach_availability, public.coach_bookings, public.coach_events, public.coach_event_signups from anon;
grant select, insert, update, delete on public.coach_packages, public.coach_vouchers, public.coach_payments, public.coach_client_packages,
  public.coach_availability, public.coach_bookings, public.coach_events, public.coach_event_signups to authenticated;

-- Trainer side (their own, or the trainer an owner is viewing)
create policy coach_packages_trainer on public.coach_packages for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_vouchers_trainer on public.coach_vouchers for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_client_packages_trainer on public.coach_client_packages for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_availability_trainer on public.coach_availability for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_bookings_trainer on public.coach_bookings for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_events_trainer on public.coach_events for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_event_signups_trainer on public.coach_event_signups for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
-- Trainers record cash and other payments themselves; Stripe payments only come from the payment function
create policy coach_payments_trainer_read on public.coach_payments for select to authenticated using (trainer_id = (select public.coach_acting()));
create policy coach_payments_trainer_add on public.coach_payments for insert to authenticated
  with check (trainer_id = (select public.coach_acting_write()) and method <> 'stripe' and stripe_session_id is null);
create policy coach_payments_trainer_change on public.coach_payments for update to authenticated
  using (trainer_id = (select public.coach_acting()) and method <> 'stripe') with check (trainer_id = (select public.coach_acting_write()) and method <> 'stripe');
create policy coach_payments_trainer_remove on public.coach_payments for delete to authenticated
  using (trainer_id = (select public.coach_acting_write()) and method <> 'stripe');

-- Client side: what their trainer offers, and their own purchases, credits, sessions and signups
create policy coach_packages_client on public.coach_packages for select to authenticated
  using (visible and not archived and trainer_id in (select public.coach_my_trainer_ids())
         and (cardinality(client_ids) = 0 or public.coach_my_client_id(trainer_id) = any (client_ids)));
create policy coach_payments_client on public.coach_payments for select to authenticated using (public.coach_is_client(client_id));
create policy coach_client_packages_client on public.coach_client_packages for select to authenticated using (public.coach_is_client(client_id));
create policy coach_availability_client on public.coach_availability for select to authenticated using (trainer_id in (select public.coach_my_trainer_ids()));
create policy coach_bookings_client on public.coach_bookings for select to authenticated
  using (public.coach_is_client(client_id)
         or public.coach_in_my_group(group_id));
create policy coach_events_client on public.coach_events for select to authenticated
  using (visible and trainer_id in (select public.coach_my_trainer_ids()));
create policy coach_event_signups_client on public.coach_event_signups for select to authenticated using (public.coach_is_client(client_id));
