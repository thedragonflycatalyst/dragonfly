-- Owner decisions, 2026-11-07:
--  1. Every finalized appointment has a package attached. When the client's package runs out, that appointment becomes a
--     single session at the trainer's single-session price. If a package is bought before the session happens, the
--     session uses it instead. With a card on file, a single session is paid as soon as it's booked; without one, it
--     stays outstanding after it happens and the client can't book again until it's paid. Trainers whose clients pay
--     elsewhere (e.g. Columbia Association) switch session billing to "handled elsewhere" and none of this applies.
--  2. Trainers connect their own Stripe account and set their own prices (packages, single sessions, group classes).
--  3. Rescheduling moves a session to another free time; within 24 hours of it, only to another time the same day.
--  4. Slot waitlist offers go to the first 3 people waiting, then 3 more every hour.
--  5. A client can leave a review at any time, not only when asked.
--  6. No refunds by default; the account owner can still override for an exceptional case (with a reason).

-- ------------------------------------------------------------ trainer billing settings and Stripe connection
alter table public.coach_trainers
  add column session_billing text not null default 'external' check (session_billing in ('app', 'external')),
  add column single_session_cents int check (single_session_cents between 50 and 10000000),
  add column session_currency text not null default 'usd' check (session_currency ~ '^[a-z]{3}$'),
  add column stripe_account text check (stripe_account ~ '^acct_[A-Za-z0-9]+$'),
  add column stripe_charges_enabled boolean not null default false;

-- Only the server (coach-pay, after Stripe confirms) sets the connected account
create function public.coach_trainer_stripe_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.stripe_account := null; new.stripe_charges_enabled := false;
  elsif new.stripe_account is distinct from old.stripe_account or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled then
    raise exception 'stripe_connection_is_set_by_stripe' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger coach_trainer_stripe_guard before insert or update on public.coach_trainers for each row execute function public.coach_trainer_stripe_guard();
revoke execute on function public.coach_trainer_stripe_guard() from public, anon, authenticated;

-- Trainers already using the app opt in (nothing changes for them, e.g. Columbia Association billing); new trainers start on
alter table public.coach_trainers alter column session_billing set default 'app';

alter table public.coach_payments add column stripe_account text check (stripe_account ~ '^acct_[A-Za-z0-9]+$');

-- A client's saved card (Stripe keeps the card; we keep which one and how to show it). Written by the server only.
create table public.coach_client_cards (
  client_id uuid primary key references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  stripe_account text check (stripe_account ~ '^acct_[A-Za-z0-9]+$'),     -- null = the Dragonfly platform account
  stripe_customer text not null check (stripe_customer ~ '^cus_[A-Za-z0-9]+$'),
  payment_method text not null check (payment_method ~ '^pm_[A-Za-z0-9]+$'),
  brand text check (char_length(brand) <= 30),
  last4 text check (last4 ~ '^[0-9]{4}$'),
  exp_month int check (exp_month between 1 and 12),
  exp_year int check (exp_year between 2000 and 2100),
  updated_at timestamptz not null default now()
);
alter table public.coach_client_cards enable row level security;
revoke all on public.coach_client_cards from anon;
grant select, delete on public.coach_client_cards to authenticated;
create policy coach_client_cards_read on public.coach_client_cards for select to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id));
-- The client can remove their card (stops automatic payment); the trainer can't
create policy coach_client_cards_remove on public.coach_client_cards for delete to authenticated using (public.coach_is_client(client_id));

-- ------------------------------------------------------------ what each session is paid with
create table public.coach_session_charges (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  booking_id uuid references public.coach_bookings(id) on delete set null,
  on_date date not null,                                   -- the session's date (trainer's time zone)
  starts_at timestamptz not null,
  -- package: a package covers it · pending: single session, not paid yet · paid · due: it happened and isn't paid
  -- waived: the trainer let it go · cancelled: the session was cancelled · credit: paid, then cancelled (used by the next session)
  status text not null check (status in ('package', 'pending', 'paid', 'due', 'waived', 'cancelled', 'credit')),
  client_package_id uuid references public.coach_client_packages(id) on delete set null,
  used_credit boolean not null default false,              -- true when a package credit was taken (returned on cancel)
  amount_cents int check (amount_cents between 0 and 10000000),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  payment_id uuid references public.coach_payments(id) on delete set null,
  attempts int not null default 0,
  last_error text check (char_length(last_error) <= 200),
  note text check (char_length(note) <= 300),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index coach_session_charges_occurrence on public.coach_session_charges (booking_id, on_date) where booking_id is not null;
create index coach_session_charges_client_idx on public.coach_session_charges (client_id, status, starts_at);
create index coach_session_charges_trainer_idx on public.coach_session_charges (trainer_id, status, starts_at desc);
alter table public.coach_session_charges enable row level security;
revoke all on public.coach_session_charges from anon;
grant select on public.coach_session_charges to authenticated;
create policy coach_session_charges_read on public.coach_session_charges for select to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id));

-- Package covering the client on a date: unlimited memberships first (no credit taken), otherwise one credit
create function public.coach_charge_cover(p_client uuid, p_day date, out pkg uuid, out took boolean)
language plpgsql security definer set search_path = '' as $$
begin
  took := false;
  select id into pkg from public.coach_client_packages
   where client_id = p_client and status = 'active' and credits_total is null and starts_on <= p_day and (expires_on is null or expires_on >= p_day)
   order by expires_on nulls last, created_at limit 1;
  if pkg is not null then return; end if;
  select id into pkg from public.coach_client_packages
   where client_id = p_client and status = 'active' and credits_total is not null and credits_total > credits_used
     and starts_on <= greatest(p_day, current_date) and (expires_on is null or expires_on >= p_day)
   order by expires_on nulls last, created_at limit 1 for update;
  if pkg is not null then
    update public.coach_client_packages set credits_used = credits_used + 1 where id = pkg;
    took := true;
  end if;
end $$;
revoke execute on function public.coach_charge_cover(uuid, date) from public, anon, authenticated;

-- Attach payment to one occurrence of a client session (idempotent)
create function public.coach_charge_attach(p_booking uuid, p_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.coach_bookings%rowtype; t public.coach_trainers%rowtype; r tstzrange; cr uuid; pk uuid; took boolean;
begin
  select * into b from public.coach_bookings where id = p_booking;
  if not found or b.client_id is null or b.kind <> 'session' then return; end if;
  select * into t from public.coach_trainers where user_id = b.trainer_id;
  if t.session_billing <> 'app' then return; end if;
  if exists (select 1 from public.coach_session_charges where booking_id = b.id and on_date = p_day) then return; end if;
  r := public.coach_booking_on(b, p_day, coalesce(t.timezone, 'UTC'));
  if r is null then return; end if;
  -- A session paid for and then cancelled moves to this one
  select id into cr from public.coach_session_charges where client_id = b.client_id and status = 'credit' order by created_at limit 1 for update skip locked;
  if cr is not null then
    update public.coach_session_charges set booking_id = b.id, on_date = p_day, starts_at = lower(r), status = 'paid',
      note = 'Paid session moved from a cancelled one' where id = cr;
    return;
  end if;
  select c.pkg, c.took into pk, took from public.coach_charge_cover(b.client_id, p_day) c;
  if pk is not null then
    insert into public.coach_session_charges (trainer_id, client_id, booking_id, on_date, starts_at, status, client_package_id, used_credit)
    values (b.trainer_id, b.client_id, b.id, p_day, lower(r), 'package', pk, took);
  else
    insert into public.coach_session_charges (trainer_id, client_id, booking_id, on_date, starts_at, status, amount_cents, currency)
    values (b.trainer_id, b.client_id, b.id, p_day, lower(r), 'pending', t.single_session_cents, t.session_currency);
  end if;
end $$;
revoke execute on function public.coach_charge_attach(uuid, date) from public, anon, authenticated;

-- Attach every occurrence of a booking in the next p_days days
create function public.coach_charge_attach_booking(p_booking uuid, p_days int default 14) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.coach_bookings%rowtype; tz text; d date;
begin
  select * into b from public.coach_bookings where id = p_booking;
  if not found or b.client_id is null or b.kind <> 'session' then return; end if;
  select coalesce(timezone, 'UTC') into tz from public.coach_trainers where user_id = b.trainer_id;
  if b.repeat = 'none' then
    if b.starts_at > now() - interval '1 day' then perform public.coach_charge_attach(b.id, (b.starts_at at time zone tz)::date); end if;
    return;
  end if;
  for d in select generate_series((now() at time zone tz)::date, (now() at time zone tz)::date + p_days, interval '1 day')::date loop
    perform public.coach_charge_attach(b.id, d);
  end loop;
end $$;
revoke execute on function public.coach_charge_attach_booking(uuid, int) from public, anon, authenticated;

-- Give back what an occurrence was paid with when it's cancelled
create function public.coach_charge_release(p_charge uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.coach_session_charges%rowtype;
begin
  select * into c from public.coach_session_charges where id = p_charge for update;
  if not found then return; end if;
  if c.status = 'package' then
    if c.used_credit and c.client_package_id is not null then
      update public.coach_client_packages set credits_used = greatest(credits_used - 1, 0) where id = c.client_package_id;
    end if;
    update public.coach_session_charges set status = 'cancelled', settled_at = now(), booking_id = null, note = 'Session cancelled; package session returned' where id = c.id;
  elsif c.status = 'pending' then
    update public.coach_session_charges set status = 'cancelled', settled_at = now(), booking_id = null where id = c.id;
  elsif c.status = 'paid' then
    update public.coach_session_charges set status = 'credit', booking_id = null, note = 'Session cancelled; the payment covers the next session' where id = c.id;
  end if;
end $$;
revoke execute on function public.coach_charge_release(uuid) from public, anon, authenticated;

create function public.coach_booking_charges() returns trigger language plpgsql security definer set search_path = '' as $$
declare tz text; d date; c uuid;
begin
  if tg_op = 'DELETE' then
    for c in select id from public.coach_session_charges where booking_id = old.id and status in ('package', 'pending', 'paid') and starts_at > now() loop
      perform public.coach_charge_release(c);
    end loop;
    return old;
  end if;
  if tg_op = 'INSERT' then perform public.coach_charge_attach_booking(new.id); return null; end if;
  -- Skipped dates: release them
  for d in select x from unnest(new.skipped) x where not (x = any (old.skipped)) loop
    for c in select id from public.coach_session_charges where booking_id = new.id and on_date = d and status in ('package', 'pending', 'paid') loop
      perform public.coach_charge_release(c);
    end loop;
  end loop;
  -- A one-off moved to another time: the charge follows it
  if new.repeat = 'none' and new.starts_at is distinct from old.starts_at then
    select coalesce(timezone, 'UTC') into tz from public.coach_trainers where user_id = new.trainer_id;
    update public.coach_session_charges set starts_at = new.starts_at, on_date = (new.starts_at at time zone tz)::date
     where booking_id = new.id and status in ('package', 'pending', 'paid');
  end if;
  return null;
end $$;
create trigger coach_booking_charges_del before delete on public.coach_bookings for each row execute function public.coach_booking_charges();
create trigger coach_booking_charges_ins after insert on public.coach_bookings for each row execute function public.coach_booking_charges();
create trigger coach_booking_charges_upd after update of skipped, starts_at on public.coach_bookings for each row execute function public.coach_booking_charges();
revoke execute on function public.coach_booking_charges() from public, anon, authenticated;

-- A package bought: unpaid sessions (oldest first: outstanding, then upcoming) use it
create function public.coach_package_covers_sessions() returns trigger language plpgsql security definer set search_path = '' as $$
declare c public.coach_session_charges%rowtype; pk uuid; took boolean;
begin
  if new.status <> 'active' then return null; end if;
  for c in select * from public.coach_session_charges where client_id = new.client_id and status in ('due', 'pending')
           order by (status = 'pending'), starts_at for update loop
    select x.pkg, x.took into pk, took from public.coach_charge_cover(c.client_id, c.on_date) x;
    exit when pk is null;
    update public.coach_session_charges set status = 'package', client_package_id = pk, used_credit = took, settled_at = now(),
      note = case when c.status = 'due' then 'Paid with a package bought afterwards' else null end where id = c.id;
  end loop;
  return null;
end $$;
create trigger coach_package_covers_sessions after insert on public.coach_client_packages for each row execute function public.coach_package_covers_sessions();
revoke execute on function public.coach_package_covers_sessions() from public, anon, authenticated;

-- Outstanding sessions stop the client booking more (trainers can still book them; moving a session isn't blocked)
create function public.coach_booking_payment_check() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.booked_by = 'client' and new.client_id is not null and current_setting('coach.rescheduling', true) is distinct from 'on'
     and exists (select 1 from public.coach_session_charges where client_id = new.client_id and status = 'due') then
    raise exception 'payment_due' using errcode = '42501', hint = 'Pay for your last session to book another';
  end if;
  return new;
end $$;
create trigger coach_booking_payment_check before insert on public.coach_bookings for each row execute function public.coach_booking_payment_check();
revoke execute on function public.coach_booking_payment_check() from public, anon, authenticated;

-- Every 15 minutes (coach-outbox): attach the next two weeks of repeating sessions, and mark sessions that happened
-- without payment as outstanding. Cards are charged by coach-outbox right after.
create function public.coach_session_charges_tick() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b uuid; n_due int; n_waived int;
begin
  for b in select bk.id from public.coach_bookings bk join public.coach_trainers t on t.user_id = bk.trainer_id
            where t.session_billing = 'app' and bk.client_id is not null and bk.kind = 'session'
              and ((bk.repeat <> 'none' and (bk.repeat_until is null or bk.repeat_until >= current_date))
                   or (bk.repeat = 'none' and bk.starts_at > now())) loop
    perform public.coach_charge_attach_booking(b);
  end loop;
  -- No price set: nothing to collect
  update public.coach_session_charges set status = 'waived', settled_at = now(), note = 'No single-session price set'
   where status = 'pending' and amount_cents is null and starts_at <= now();
  get diagnostics n_waived = row_count;
  -- Happened, no card (or the card failed): outstanding
  update public.coach_session_charges c set status = 'due'
   where c.status = 'pending' and c.starts_at <= now() and c.amount_cents is not null
     and (c.attempts > 0 or not exists (select 1 from public.coach_client_cards k where k.client_id = c.client_id));
  get diagnostics n_due = row_count;
  return jsonb_build_object('due', n_due, 'waived', n_waived);
end $$;
revoke execute on function public.coach_session_charges_tick() from public, anon, authenticated;
grant execute on function public.coach_session_charges_tick() to service_role;

-- Trainer settles an unpaid session by hand: paid (cash, card machine, etc.) or waived
create function public.coach_charge_settle(p_charge uuid, p_status text, p_method text default 'cash', p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.coach_session_charges%rowtype; pay uuid;
begin
  select * into c from public.coach_session_charges where id = p_charge for update;
  if not found or not public.coach_owns_client(c.client_id) then raise exception 'not_your_client' using errcode = '42501'; end if;
  if c.status not in ('pending', 'due') then raise exception 'already_settled' using errcode = '22023'; end if;
  if p_status = 'waived' then
    update public.coach_session_charges set status = 'waived', settled_at = now(), note = left(nullif(trim(coalesce(p_note, '')), ''), 300) where id = c.id;
  elsif p_status = 'paid' then
    if p_method not in ('cash', 'card', 'transfer', 'other') then raise exception 'bad_method' using errcode = '22023'; end if;
    insert into public.coach_payments (trainer_id, client_id, description, amount_cents, currency, status, method, note)
    values (c.trainer_id, c.client_id, 'Single session ' || to_char(c.on_date, 'Mon DD'), coalesce(c.amount_cents, 0), c.currency, 'paid', p_method, left(p_note, 1000))
    returning id into pay;
    update public.coach_session_charges set status = 'paid', payment_id = pay, settled_at = now() where id = c.id;
  else
    raise exception 'bad_status' using errcode = '22023';
  end if;
end $$;
revoke execute on function public.coach_charge_settle(uuid, text, text, text) from public, anon;
grant execute on function public.coach_charge_settle(uuid, text, text, text) to authenticated;

-- ------------------------------------------------------------ rescheduling
-- Move one session (one date of a repeating booking, or a one-off) to another free time. Within 24 hours of the
-- session it can only move to another time the same day. The old time goes to the slot waitlist.
create function public.coach_reschedule_session(p_booking uuid, p_on date, p_new timestamptz) returns uuid
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
  if lower(r) < now() + interval '24 hours' and nd <> p_on then raise exception 'same_day_only' using errcode = '22023'; end if;
  if p_new < now() + interval '1 hour' or p_new > now() + interval '120 days' then raise exception 'bad_time' using errcode = '22023'; end if;
  if p_new = lower(r) then return b.id; end if;
  if is_client and not exists (select 1 from public.coach_availability a where a.trainer_id = b.trainer_id and a.weekday = extract(dow from loc)
                  and a.start_time <= loc::time and a.end_time >= (loc + make_interval(mins => b.duration_min))::time) then
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
  return v;
end $$;
revoke execute on function public.coach_reschedule_session(uuid, date, timestamptz) from public, anon;
grant execute on function public.coach_reschedule_session(uuid, date, timestamptz) to authenticated;

-- ------------------------------------------------------------ waitlist offers in waves of 3, every hour
alter table public.coach_open_slots
  add column offer_id uuid references public.coach_slot_offers(id) on delete set null,
  add column offered int not null default 0,
  add column next_wave_at timestamptz;

-- ------------------------------------------------------------ reviews any time
alter table public.coach_testimonials drop constraint coach_testimonials_source_check;
alter table public.coach_testimonials add constraint coach_testimonials_source_check check (source in ('ask', 'survey', 'manual', 'self'));

-- The signed-in client's review link for their trainer: their latest draft or review, or a new one
create function public.coach_my_testimonial(p_trainer uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c uuid := public.coach_my_client_id(p_trainer); tok uuid;
begin
  if c is null then raise exception 'not your trainer' using errcode = '42501'; end if;
  select token into tok from public.coach_testimonials where client_id = c and status in ('draft', 'published', 'withdrawn') order by created_at desc limit 1;
  if tok is not null then return tok; end if;
  perform set_config('coach.testimonial_link', 'on', true);
  insert into public.coach_testimonials (client_id, trainer_id, source) values (c, p_trainer, 'self') returning token into tok;
  return tok;
end $$;
revoke execute on function public.coach_my_testimonial(uuid) from public, anon;
grant execute on function public.coach_my_testimonial(uuid) to authenticated;

-- ------------------------------------------------------------ refunds: none by default
alter table public.coach_refund_policies alter column mode set default 'none';
create or replace function public.coach_refund_terms(p_trainer uuid, p_package uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'mode', coalesce(pk.refund_mode, rp.mode, 'none'),
    'window_days', coalesce(pk.refund_window_days, rp.window_days, 30),
    'fee_cents', coalesce(rp.fee_cents, 0),
    'expired_refundable', coalesce(rp.expired_refundable, false),
    'event_cutoff_hours', coalesce(rp.event_cutoff_hours, 24),
    'extra_terms', rp.extra_terms)
  from (select 1) one
  left join public.coach_refund_policies rp on rp.trainer_id = p_trainer
  left join public.coach_packages pk on pk.id = p_package
$$;
