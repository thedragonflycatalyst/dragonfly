-- Client pool: who to offer an open slot to when someone cancels.
-- Each client has a frequency tier, the times they're usually free, and an opt-in for short-notice offers.
-- A slot offer goes to several clients at once; the first to accept (by link, signed in or not) gets the booking.
-- coach_clients.client_of keeps Columbia Association clients apart from private ones (owner decision pending; outbound
-- marketing features skip 'ca' clients by default).

alter table public.coach_clients
  add column frequency_tier text not null default 'regular' check (frequency_tier in ('regular', 'occasional', 'on_call', 'lapsed', 'prospect')),
  add column short_notice_ok boolean not null default false,
  add column short_notice_at timestamptz,
  add column client_of text not null default 'private' check (client_of in ('private', 'ca', 'other'));

-- When a client is usually free (weekday 0 = Sunday, local times)
create table public.coach_client_availability (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index coach_client_availability_client_idx on public.coach_client_availability (client_id, weekday);

create table public.coach_slot_offers (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references public.coach_trainers(user_id) on delete cascade,
  booking_id uuid references public.coach_bookings(id) on delete set null,   -- the cancelled booking this replaces, if any
  starts_at timestamptz not null,
  duration_min int not null default 60 check (duration_min between 5 and 720),
  title text not null default 'Session' check (char_length(title) between 1 and 120),
  location text check (char_length(location) <= 200),
  expires_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'filled', 'withdrawn')),
  filled_by uuid references public.coach_clients(id) on delete set null,
  filled_booking_id uuid references public.coach_bookings(id) on delete set null,
  filled_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at <= starts_at)
);
create index coach_slot_offers_trainer_idx on public.coach_slot_offers (trainer_id, starts_at desc);

create table public.coach_slot_offer_recipients (
  offer_id uuid not null references public.coach_slot_offers(id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  sent_at timestamptz,
  channel text check (channel in ('sms', 'whatsapp', 'app', 'push', 'email')),
  responded_at timestamptz,
  response text check (response in ('accepted', 'declined', 'too_late')),
  primary key (offer_id, client_id)
);

-- Clients on an offer must be the offering trainer's own
create function public.coach_slot_recipient_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.coach_slot_offers o join public.coach_clients c on c.trainer_id = o.trainer_id
                 where o.id = new.offer_id and c.id = new.client_id) then
    raise exception 'not_your_client' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger coach_slot_recipient_guard before insert or update on public.coach_slot_offer_recipients for each row execute function public.coach_slot_recipient_guard();
revoke execute on function public.coach_slot_recipient_guard() from public, anon, authenticated;

alter table public.coach_client_availability enable row level security;
alter table public.coach_slot_offers enable row level security;
alter table public.coach_slot_offer_recipients enable row level security;
revoke all on public.coach_client_availability, public.coach_slot_offers, public.coach_slot_offer_recipients from anon;
grant select, insert, update, delete on public.coach_client_availability to authenticated;
grant select, insert, update on public.coach_slot_offers, public.coach_slot_offer_recipients to authenticated;

-- Availability: the client keeps their own; the trainer can set it for them
create policy coach_client_availability_rw on public.coach_client_availability for all to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id))
  with check (public.coach_is_client(client_id) or public.coach_owns_client(client_id));
-- Offers: the trainer's own; clients reach theirs only through the token functions below
create policy coach_slot_offers_trainer on public.coach_slot_offers for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_slot_recipients_trainer on public.coach_slot_offer_recipients for all to authenticated
  using (exists (select 1 from public.coach_slot_offers o where o.id = offer_id and o.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.coach_slot_offers o where o.id = offer_id and o.trainer_id = (select auth.uid())));

-- The client's opt-in is theirs to give: a trainer may switch it off but not on
create function public.coach_short_notice_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.short_notice_ok and not old.short_notice_ok then
    if not public.coach_is_client(new.id) then raise exception 'client_must_opt_in' using errcode = '42501'; end if;
    new.short_notice_at := now();
  end if;
  return new;
end $$;
create trigger coach_short_notice_guard before update of short_notice_ok on public.coach_clients for each row execute function public.coach_short_notice_guard();
revoke execute on function public.coach_short_notice_guard() from public, anon, authenticated;

-- Let a client change only their own opt-in (the trainer manages the rest of the client record)
create function public.coach_set_short_notice(p_ok boolean) returns void language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.coach_clients set short_notice_ok = p_ok where user_id = (select auth.uid());
  get diagnostics n = row_count;
  if n = 0 then raise exception 'not_a_client' using errcode = '42501'; end if;
end $$;
revoke execute on function public.coach_set_short_notice(boolean) from public, anon;
grant execute on function public.coach_set_short_notice(boolean) to authenticated;

-- What the link shows (no other client's details, no contact info)
create function public.coach_slot_offer_view(p_token uuid) returns table (
  starts_at timestamptz, duration_min int, title text, location text, trainer_name text, client_first text, state text)
language sql stable security definer set search_path = '' as $$
  select o.starts_at, o.duration_min, o.title, o.location, t.display_name, split_part(c.name, ' ', 1),
    case when r.response = 'accepted' then 'yours'
         when o.status = 'filled' then 'filled'
         when o.status = 'withdrawn' then 'withdrawn'
         when o.expires_at < now() then 'expired'
         when r.response = 'declined' then 'declined'
         else 'open' end
  from public.coach_slot_offer_recipients r
  join public.coach_slot_offers o on o.id = r.offer_id
  join public.coach_trainers t on t.user_id = o.trainer_id
  join public.coach_clients c on c.id = r.client_id
  where r.token = p_token
$$;
revoke execute on function public.coach_slot_offer_view(uuid) from public;
grant execute on function public.coach_slot_offer_view(uuid) to anon, authenticated;

-- Accept or decline by link. The first acceptance wins; it books the session for the client.
create function public.coach_answer_slot_offer(p_token uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare r record; o record; b uuid;
begin
  select * into r from public.coach_slot_offer_recipients where token = p_token;
  if not found then raise exception 'bad_link' using errcode = 'P0002'; end if;
  select * into o from public.coach_slot_offers where id = r.offer_id for update;
  if r.response = 'accepted' then return 'yours'; end if;
  if not p_accept then
    update public.coach_slot_offer_recipients set response = 'declined', responded_at = now() where token = p_token;
    return 'declined';
  end if;
  if o.status <> 'open' or o.expires_at < now() then
    update public.coach_slot_offer_recipients set response = 'too_late', responded_at = now() where token = p_token;
    return case when o.status = 'withdrawn' then 'withdrawn' when o.status = 'filled' then 'filled' else 'expired' end;
  end if;
  insert into public.coach_bookings (trainer_id, client_id, title, kind, location, starts_at, duration_min, booked_by)
    values (o.trainer_id, r.client_id, o.title, 'session', o.location, o.starts_at, o.duration_min, 'client') returning id into b;
  update public.coach_slot_offers set status = 'filled', filled_by = r.client_id, filled_booking_id = b, filled_at = now() where id = o.id;
  update public.coach_slot_offer_recipients set response = 'accepted', responded_at = now() where token = p_token;
  update public.coach_slot_offer_recipients set response = 'too_late', responded_at = now()
    where offer_id = o.id and token <> p_token and response is null;
  return 'yours';
end $$;
revoke execute on function public.coach_answer_slot_offer(uuid, boolean) from public;
grant execute on function public.coach_answer_slot_offer(uuid, boolean) to anon, authenticated;

-- When each of the trainer's clients last trained (for the roster and ranking)
create function public.coach_client_last_seen() returns table (client_id uuid, last_at timestamptz, sessions_90d int)
language sql stable security invoker set search_path = '' as $$
  select c.id, greatest(max(l.performed_at), max(c.last_session_at)), count(l.id) filter (where l.performed_at > now() - interval '90 days')::int
  from public.coach_clients c left join public.coach_logs l on l.client_id = c.id
  where c.trainer_id = (select auth.uid())
  group by c.id
$$;
grant execute on function public.coach_client_last_seen() to authenticated;
