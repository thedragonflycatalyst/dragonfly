-- Engagement: short surveys, client-approved testimonials (published to the website only after the client approves
-- the exact words and how their name shows), referral links, and joining a group session by text.
-- Link pages work without signing in: each link carries a random token that only the client received.

-- ------------------------------------------------------------ surveys
create table public.coach_survey_responses (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null unique references public.coach_outbox(id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_survey_responses_trainer_idx on public.coach_survey_responses (trainer_id, created_at desc);

-- ------------------------------------------------------------ testimonials
create table public.coach_testimonials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  body text check (char_length(body) <= 1500),
  display_style text not null default 'first_initial' check (display_style in ('first_name', 'first_initial', 'anonymous')),
  display_name text check (char_length(display_name) <= 80),     -- worked out from the style when approved
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn', 'hidden')),
  hidden_reason text check (char_length(hidden_reason) <= 300),
  source text not null default 'ask' check (source in ('ask', 'survey', 'manual')),
  milestone text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  published_at timestamptz,
  check (status <> 'published' or (approved_at is not null and char_length(coalesce(body, '')) >= 5)),
  check (status <> 'hidden' or char_length(coalesce(hidden_reason, '')) > 0)
);
create index coach_testimonials_trainer_idx on public.coach_testimonials (trainer_id, status, published_at desc);

-- Trainers can hide a published testimonial (with a reason) or show it again; they can't write or change the words
create function public.coach_testimonial_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- service role, and the client's own link (coach_testimonial_submit sets coach.testimonial_link for its transaction)
  if auth.uid() is null or current_setting('coach.testimonial_link', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then raise exception 'testimonials_come_from_clients' using errcode = '42501'; end if;
  if new.body is distinct from old.body or new.display_style is distinct from old.display_style or new.display_name is distinct from old.display_name
     or new.approved_at is distinct from old.approved_at or new.client_id <> old.client_id or new.token <> old.token then
    raise exception 'testimonial_words_are_the_clients' using errcode = '42501';
  end if;
  if not ((old.status = 'published' and new.status = 'hidden') or (old.status = 'hidden' and new.status = 'published')) then
    raise exception 'testimonial_status_locked' using errcode = '42501';
  end if;
  if new.status = 'published' then new.hidden_reason := null; end if;
  return new;
end $$;
create trigger coach_testimonial_guard before insert or update on public.coach_testimonials for each row execute function public.coach_testimonial_guard();
revoke execute on function public.coach_testimonial_guard() from public, anon, authenticated;

-- ------------------------------------------------------------ referrals
create table public.coach_referrals (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  referrer_client_id uuid not null unique references public.coach_clients(id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);
create table public.coach_referral_signups (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.coach_referrals(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  lead_client_id uuid references public.coach_clients(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 40),
  message text check (char_length(message) <= 1000),
  status text not null default 'new' check (status in ('new', 'contacted', 'joined', 'declined')),
  reward_note text check (char_length(reward_note) <= 300),
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index coach_referral_signups_trainer_idx on public.coach_referral_signups (trainer_id, created_at desc);

alter table public.coach_survey_responses enable row level security;
alter table public.coach_testimonials enable row level security;
alter table public.coach_referrals enable row level security;
alter table public.coach_referral_signups enable row level security;
revoke all on public.coach_survey_responses, public.coach_testimonials, public.coach_referrals, public.coach_referral_signups from anon;
grant select on public.coach_survey_responses, public.coach_referrals to authenticated;
grant select, update on public.coach_testimonials, public.coach_referral_signups to authenticated;
create policy coach_survey_responses_read on public.coach_survey_responses for select to authenticated
  using (trainer_id = (select auth.uid()) or public.coach_is_client(client_id));
create policy coach_testimonials_trainer on public.coach_testimonials for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_testimonials_client on public.coach_testimonials for select to authenticated
  using (public.coach_is_client(client_id));
create policy coach_referrals_read on public.coach_referrals for select to authenticated
  using (trainer_id = (select auth.uid()) or public.coach_is_client(referrer_client_id));
create policy coach_referral_signups_trainer on public.coach_referral_signups for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));

-- ------------------------------------------------------------ link functions (anyone holding the token)
create function public.coach_survey_view(p_token uuid) returns table (trainer_name text, client_first text, rating smallint, comment text)
language sql stable security definer set search_path = '' as $$
  select t.display_name, c.first_name, r.rating, r.comment
  from public.coach_outbox o join public.coach_trainers t on t.user_id = o.trainer_id join public.coach_clients c on c.id = o.client_id
  left join public.coach_survey_responses r on r.outbox_id = o.id
  where o.token = p_token and o.kind = 'survey' and o.status = 'sent'
$$;

-- Saves an answer (by outbox id from the SMS webhook, or by link token). A 5 with a comment becomes a testimonial draft
-- for the client to approve; nothing is published without that approval.
create function public.coach_survey_answer(p_outbox uuid, p_rating int, p_comment text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.coach_outbox%rowtype;
begin
  select * into o from public.coach_outbox where id = p_outbox and kind = 'survey';
  if not found then raise exception 'bad_link' using errcode = 'P0002'; end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then raise exception 'rating_1_to_5' using errcode = '22023'; end if;
  insert into public.coach_survey_responses (outbox_id, client_id, trainer_id, rating, comment)
    values (o.id, o.client_id, o.trainer_id, p_rating, nullif(left(trim(coalesce(p_comment, '')), 1000), ''))
    on conflict (outbox_id) do update set rating = coalesce(excluded.rating, public.coach_survey_responses.rating),
      comment = coalesce(excluded.comment, public.coach_survey_responses.comment), updated_at = now();
end $$;
create function public.coach_survey_answer_link(p_token uuid, p_rating int, p_comment text) returns void
language plpgsql security definer set search_path = '' as $$
declare id uuid;
begin
  select o.id into id from public.coach_outbox o where o.token = p_token and o.kind = 'survey' and o.status = 'sent';
  if id is null then raise exception 'bad_link' using errcode = 'P0002'; end if;
  perform public.coach_survey_answer(id, p_rating, p_comment);
end $$;

create function public.coach_testimonial_view(p_token uuid) returns table (trainer_name text, client_first text, client_last_initial text, body text, display_style text, status text)
language sql stable security definer set search_path = '' as $$
  select tr.display_name, c.first_name, left(c.last_name, 1), t.body, t.display_style, t.status
  from public.coach_testimonials t join public.coach_trainers tr on tr.user_id = t.trainer_id join public.coach_clients c on c.id = t.client_id
  where t.token = p_token
$$;

-- The client writes or edits their words and, if they approve, it is published (and can be withdrawn the same way)
create function public.coach_testimonial_submit(p_token uuid, p_body text, p_style text, p_publish boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare t public.coach_testimonials%rowtype; c public.coach_clients%rowtype; nm text; b text := trim(coalesce(p_body, ''));
begin
  select * into t from public.coach_testimonials where token = p_token for update;
  if not found then raise exception 'bad_link' using errcode = 'P0002'; end if;
  if t.status = 'hidden' then return 'hidden'; end if;
  perform set_config('coach.testimonial_link', 'on', true);
  if p_style not in ('first_name', 'first_initial', 'anonymous') then raise exception 'bad_style' using errcode = '22023'; end if;
  if char_length(b) > 1500 then raise exception 'too_long' using errcode = '22023'; end if;
  select * into c from public.coach_clients where id = t.client_id;
  nm := case p_style when 'first_name' then c.first_name when 'first_initial' then trim(c.first_name || ' ' || left(c.last_name, 1) || case when c.last_name <> '' then '.' else '' end) else 'A client' end;
  if p_publish then
    if char_length(b) < 5 then raise exception 'write_a_little_more' using errcode = '22023'; end if;
    update public.coach_testimonials set body = b, display_style = p_style, display_name = nm, status = 'published', approved_at = now(), published_at = now() where id = t.id;
    return 'published';
  end if;
  update public.coach_testimonials set body = nullif(b, ''), display_style = p_style, display_name = nm,
    status = case when t.status = 'published' then 'withdrawn' else 'draft' end where id = t.id;
  return case when t.status = 'published' then 'withdrawn' else 'draft' end;
end $$;

create function public.coach_referral_view(p_code text) returns table (trainer_name text, business_name text, referrer_first text)
language sql stable security definer set search_path = '' as $$
  select t.display_name, t.business_name, c.first_name
  from public.coach_referrals r join public.coach_trainers t on t.user_id = r.trainer_id join public.coach_clients c on c.id = r.referrer_client_id
  where r.code = lower(p_code)
$$;

-- A friend leaves their details; they become a lead (the trainer's existing "Client pool" of prospects)
create function public.coach_referral_submit(p_code text, p_name text, p_email text, p_phone text, p_message text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.coach_referrals%rowtype; ref_first text; lead uuid; first text; last text; em text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  select * into r from public.coach_referrals where code = lower(p_code);
  if not found then raise exception 'bad_link' using errcode = 'P0002'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then raise exception 'name_required' using errcode = '22023'; end if;
  if em is null and nullif(trim(coalesce(p_phone, '')), '') is null then raise exception 'contact_required' using errcode = '22023'; end if;
  if em is not null and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email' using errcode = '22023'; end if;
  if (select count(*) from public.coach_referral_signups s where s.referral_id = r.id and s.created_at > now() - interval '1 day') >= 5 then
    raise exception 'try_again_tomorrow' using errcode = '22023';
  end if;
  select c.first_name into ref_first from public.coach_clients c where c.id = r.referrer_client_id;
  first := split_part(trim(p_name), ' ', 1); last := trim(substr(trim(p_name), char_length(first) + 1));
  if em is not null and not exists (select 1 from public.coach_clients c where c.trainer_id = r.trainer_id and lower(c.email) = em) then
    insert into public.coach_clients (trainer_id, first_name, last_name, email, phone, status, source)
      values (r.trainer_id, left(first, 60), left(last, 60), em, nullif(trim(coalesce(p_phone, '')), ''), 'lead', left('Referred by ' || coalesce(ref_first, 'a client'), 80))
      returning id into lead;
  end if;
  insert into public.coach_referral_signups (referral_id, trainer_id, lead_client_id, name, email, phone, message)
    values (r.id, r.trainer_id, lead, left(trim(p_name), 120), em, nullif(trim(coalesce(p_phone, '')), ''), nullif(left(trim(coalesce(p_message, '')), 1000), ''));
end $$;

-- Join a group session by text reply (service role): same rules as joining in the app
create function public.coach_event_join_for(p_event uuid, p_client uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare e public.coach_events%rowtype; s public.coach_event_signups%rowtype; pk uuid;
begin
  select * into e from public.coach_events where id = p_event for update;
  if not found or e.cancelled or e.starts_at < now() then return 'closed'; end if;
  if not exists (select 1 from public.coach_clients c where c.id = p_client and c.trainer_id = e.trainer_id) then return 'closed'; end if;
  select * into s from public.coach_event_signups where event_id = p_event and client_id = p_client;
  if found and s.status <> 'cancelled' then return 'already'; end if;
  if e.spaces is not null and e.booked >= e.spaces then
    if not e.waitlist then return 'full'; end if;
    insert into public.coach_event_signups (event_id, client_id, trainer_id, status) values (p_event, p_client, e.trainer_id, 'waitlist')
      on conflict (event_id, client_id) do update set status = 'waitlist', paid = false, client_package_id = null;
    return 'waitlist';
  end if;
  if e.credits is not null then pk := public.coach_use_credits(p_client, e.credits); end if;
  if pk is null and e.price_cents is not null then return 'pay'; end if;
  if pk is null and e.credits is not null then return 'no_credits'; end if;
  insert into public.coach_event_signups (event_id, client_id, trainer_id, status, client_package_id) values (p_event, p_client, e.trainer_id, 'booked', pk)
    on conflict (event_id, client_id) do update set status = 'booked', client_package_id = pk;
  return 'booked';
end $$;

-- What the website shows: published testimonials only (words, display name, date, trainer). For the website owner (Charlie).
create function public.coach_public_testimonials(p_trainer uuid default null, p_limit int default 50)
returns table (id uuid, body text, display_name text, published_at timestamptz, trainer_name text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.body, t.display_name, t.published_at, tr.display_name
  from public.coach_testimonials t join public.coach_trainers tr on tr.user_id = t.trainer_id
  where t.status = 'published' and (p_trainer is null or t.trainer_id = p_trainer)
  order by t.published_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

revoke execute on function public.coach_survey_view(uuid), public.coach_survey_answer_link(uuid, int, text), public.coach_testimonial_view(uuid),
  public.coach_testimonial_submit(uuid, text, text, boolean), public.coach_referral_view(text), public.coach_referral_submit(text, text, text, text, text),
  public.coach_public_testimonials(uuid, int) from public;
grant execute on function public.coach_survey_view(uuid), public.coach_survey_answer_link(uuid, int, text), public.coach_testimonial_view(uuid),
  public.coach_testimonial_submit(uuid, text, text, boolean), public.coach_referral_view(text), public.coach_referral_submit(text, text, text, text, text),
  public.coach_public_testimonials(uuid, int) to anon, authenticated;
revoke all on function public.coach_survey_answer(uuid, int, text), public.coach_event_join_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.coach_survey_answer(uuid, int, text), public.coach_event_join_for(uuid, uuid) to service_role;

-- A client's referral link code (the client or their trainer can get it; created on first use)
create function public.coach_referral_code(p_client uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.coach_clients%rowtype; v text;
begin
  select * into c from public.coach_clients where id = p_client;
  if not found or not (public.coach_is_client(p_client) or public.coach_owns_client(p_client) or auth.uid() is null) then
    raise exception 'not_your_client' using errcode = '42501';
  end if;
  select code into v from public.coach_referrals where referrer_client_id = p_client;
  if v is not null then return v; end if;
  loop
    v := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    exit when not exists (select 1 from public.coach_referrals where code = v);
  end loop;
  insert into public.coach_referrals (trainer_id, referrer_client_id, code) values (c.trainer_id, p_client, v);
  return v;
end $$;
revoke execute on function public.coach_referral_code(uuid) from public, anon;
grant execute on function public.coach_referral_code(uuid) to authenticated, service_role;

-- ------------------------------------------------------------ review sites (a footprint everywhere clients look)
-- The trainer lists where clients can review them (Google, Facebook, Yelp, …). After a client writes their testimonial
-- here (our copy, for the website), they can post the same words on any of those sites in one tap; we record which.
-- Review links are offered to everyone asked, not only happy clients (Google and others don't allow selective asking),
-- and never with a reward.
create table public.coach_review_links (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references public.coach_trainers(user_id) on delete cascade,
  platform text not null check (platform in ('google', 'facebook', 'yelp', 'trustpilot', 'thumbtack', 'nextdoor', 'other')),
  label text check (char_length(label) <= 60),
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  sort int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (trainer_id, platform, url)
);
create table public.coach_testimonial_shares (
  testimonial_id uuid not null references public.coach_testimonials(id) on delete cascade,
  platform text not null,
  shared_at timestamptz not null default now(),
  primary key (testimonial_id, platform)
);
alter table public.coach_review_links enable row level security;
alter table public.coach_testimonial_shares enable row level security;
revoke all on public.coach_review_links, public.coach_testimonial_shares from anon;
grant select, insert, update, delete on public.coach_review_links to authenticated;
grant select on public.coach_testimonial_shares to authenticated;
create policy coach_review_links_own on public.coach_review_links for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_testimonial_shares_trainer on public.coach_testimonial_shares for select to authenticated
  using (exists (select 1 from public.coach_testimonials t where t.id = testimonial_id and t.trainer_id = (select auth.uid())));

-- Review sites for the trainer behind a link token (survey or testimonial), for the link pages
create function public.coach_review_links_for(p_token uuid) returns table (platform text, label text, url text)
language sql stable security definer set search_path = '' as $$
  select l.platform, coalesce(l.label, initcap(l.platform)), l.url from public.coach_review_links l
  where l.active and l.trainer_id = coalesce(
    (select t.trainer_id from public.coach_testimonials t where t.token = p_token),
    (select o.trainer_id from public.coach_outbox o where o.token = p_token and o.status = 'sent'))
  order by l.sort, l.created_at
$$;
create function public.coach_testimonial_shared(p_token uuid, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
declare id uuid;
begin
  select t.id into id from public.coach_testimonials t where t.token = p_token;
  if id is null then raise exception 'bad_link' using errcode = 'P0002'; end if;
  insert into public.coach_testimonial_shares (testimonial_id, platform) values (id, left(p_platform, 20)) on conflict do nothing;
end $$;
revoke execute on function public.coach_review_links_for(uuid), public.coach_testimonial_shared(uuid, text) from public;
grant execute on function public.coach_review_links_for(uuid), public.coach_testimonial_shared(uuid, text) to anon, authenticated;
