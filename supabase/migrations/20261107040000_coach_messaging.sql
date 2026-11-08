-- Messaging foundation: one outbox for every automatic message (reminders, slot offers, surveys, testimonial and
-- referral asks, group invites), consent per purpose and channel, quiet hours and caps per trainer, and an inbox
-- for replies. The coach-outbox function (pg_cron, every 15 minutes) plans and delivers.
-- Channels: 'sms' (a texting service; off until the owner approves one and sets settings.sms_enabled), 'manual' (a
-- text the trainer sends from their phone; it waits in their "To send" list), 'email' (when an email sender is
-- configured), 'app' (Dragonfly chat). Each client picks their preferred channel; the default is text.

-- Consent: append-only, newest row per (client, purpose, channel) wins. A client gives or withdraws their own;
-- a trainer can only record a withdrawal (e.g. the client asked in person); STOP replies withdraw every SMS purpose.
create table public.coach_contact_consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  purpose text not null check (purpose in ('reminders', 'offers', 'surveys', 'marketing')),
  channel text not null check (channel in ('sms', 'app', 'email')),
  granted boolean not null,
  text_version int not null default 1,
  source text not null check (source in ('client', 'trainer', 'reply')),
  created_at timestamptz not null default now()
);
create index coach_contact_consents_idx on public.coach_contact_consents (client_id, purpose, channel, created_at desc);

create function public.coach_contact_consent_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;              -- service role (replies)
  if public.coach_is_client(new.client_id) then new.source := 'client'; return new; end if;
  if public.coach_owns_client(new.client_id) and not new.granted then new.source := 'trainer'; return new; end if;
  raise exception 'only_the_client_can_consent' using errcode = '42501';
end $$;
create trigger coach_contact_consent_guard before insert on public.coach_contact_consents for each row execute function public.coach_contact_consent_guard();
revoke execute on function public.coach_contact_consent_guard() from public, anon, authenticated;

-- Is this purpose allowed on this channel for this client right now? Session reminders and open-slot offers are about
-- sessions the client booked, so they're on by default on every channel (STOP or the client's settings turn them off);
-- surveys and marketing (testimonials, referrals, group invites) always need an explicit yes.
create function public.coach_contact_allowed(p_client uuid, p_purpose text, p_channel text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select c.granted from public.coach_contact_consents c
      where c.client_id = p_client and c.purpose = p_purpose and c.channel = p_channel
      order by c.created_at desc, c.id desc limit 1),
    p_purpose in ('reminders', 'offers'))
$$;
revoke execute on function public.coach_contact_allowed(uuid, text, text) from public, anon;
grant execute on function public.coach_contact_allowed(uuid, text, text) to authenticated, service_role;

-- How each client prefers to be reached. Default: text, the channel people are least likely to miss.
create table public.coach_contact_prefs (
  client_id uuid primary key references public.coach_clients(id) on delete cascade,
  preferred_channel text not null default 'sms' check (preferred_channel in ('sms', 'email', 'app')),
  updated_at timestamptz not null default now()
);
alter table public.coach_contact_prefs enable row level security;
revoke all on public.coach_contact_prefs from anon;
grant select, insert, update on public.coach_contact_prefs to authenticated;
create policy coach_contact_prefs_client on public.coach_contact_prefs for all to authenticated
  using (public.coach_is_client(client_id)) with check (public.coach_is_client(client_id));
create policy coach_contact_prefs_trainer on public.coach_contact_prefs for select to authenticated
  using (public.coach_owns_client(client_id));

-- Per-trainer settings (one row; defaults are conservative)
create table public.coach_message_settings (
  trainer_id uuid primary key references public.coach_trainers(user_id) on delete cascade,
  quiet_start time not null default '21:00',
  quiet_end time not null default '08:00',
  max_per_week int not null default 3 check (max_per_week between 1 and 14),
  reminders_on boolean not null default true,
  reminder_hours int[] not null default '{24}' check (reminder_hours <@ array[2, 24, 48]),
  surveys_on boolean not null default false,
  survey_every int not null default 4 check (survey_every between 1 and 20),
  survey_min_days int not null default 14 check (survey_min_days between 1 and 90),
  testimonials_on boolean not null default false,
  referrals_on boolean not null default false,
  referral_every_days int not null default 90 check (referral_every_days between 30 and 365),
  include_ca_clients boolean not null default true,           -- Columbia Association clients (owner, Nov 7: they all use the app; on)
  sms_enabled boolean not null default false,                 -- owner turns on once a texting service is approved
  updated_at timestamptz not null default now()
);

create table public.coach_outbox (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  purpose text not null check (purpose in ('reminders', 'offers', 'surveys', 'marketing')),
  kind text not null check (kind in ('reminder', 'slot_offer', 'survey', 'testimonial_ask', 'referral_ask', 'group_invite', 'note')),
  channel text not null check (channel in ('sms', 'app', 'manual', 'manual_email', 'email')),
  body text not null check (char_length(body) between 1 and 480),
  token uuid not null unique default gen_random_uuid(),       -- for link pages (survey, testimonial)
  send_after timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped', 'cancelled')),
  skip_reason text check (char_length(skip_reason) <= 200),
  provider_id text check (char_length(provider_id) <= 100),
  attempts int not null default 0,
  dedupe_key text unique check (char_length(dedupe_key) <= 200),
  related jsonb not null default '{}'::jsonb check (jsonb_typeof(related) = 'object'),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index coach_outbox_due_idx on public.coach_outbox (status, send_after) where status = 'queued';
create index coach_outbox_trainer_idx on public.coach_outbox (trainer_id, created_at desc);
create index coach_outbox_client_idx on public.coach_outbox (client_id, created_at desc);

create function public.coach_outbox_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.coach_clients c where c.id = new.client_id and c.trainer_id = new.trainer_id) then
    raise exception 'not_your_client' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.status := 'queued'; new.sent_at := null; new.attempts := 0; new.provider_id := null;
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null then
    -- Trainers may only cancel a queued message or mark a manual one sent (from their phone)
    if new.body <> old.body or new.client_id <> old.client_id or new.channel <> old.channel or new.token <> old.token then
      raise exception 'outbox_locked' using errcode = '42501';
    end if;
    if not ((old.status = 'queued' and new.status = 'cancelled') or (old.status = 'queued' and old.channel in ('manual', 'manual_email') and new.status = 'sent')) then
      raise exception 'outbox_locked' using errcode = '42501';
    end if;
    if new.status = 'sent' then new.sent_at := now(); end if;
  end if;
  return new;
end $$;
create trigger coach_outbox_guard before insert or update on public.coach_outbox for each row execute function public.coach_outbox_guard();
revoke execute on function public.coach_outbox_guard() from public, anon, authenticated;

create table public.coach_inbox (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid references public.coach_trainers(user_id) on delete cascade,
  client_id uuid references public.coach_clients(id) on delete set null,
  channel text not null check (channel in ('sms', 'app', 'link')),
  body text not null check (char_length(body) <= 2000),
  parsed jsonb not null default '{}'::jsonb,
  outbox_id uuid references public.coach_outbox(id) on delete set null,
  handled boolean not null default false,
  received_at timestamptz not null default now()
);
create index coach_inbox_trainer_idx on public.coach_inbox (trainer_id, received_at desc);

alter table public.coach_contact_consents enable row level security;
alter table public.coach_message_settings enable row level security;
alter table public.coach_outbox enable row level security;
alter table public.coach_inbox enable row level security;
revoke all on public.coach_contact_consents, public.coach_message_settings, public.coach_outbox, public.coach_inbox from anon;
grant select, insert on public.coach_contact_consents to authenticated;
grant select, insert, update on public.coach_message_settings to authenticated;
grant select, insert, update on public.coach_outbox to authenticated;
grant select, update on public.coach_inbox to authenticated;

create policy coach_contact_consents_read on public.coach_contact_consents for select to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id));
create policy coach_contact_consents_add on public.coach_contact_consents for insert to authenticated
  with check (public.coach_is_client(client_id) or public.coach_owns_client(client_id));
create policy coach_message_settings_own on public.coach_message_settings for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
-- sms_enabled can only be changed by the owner (dragonfly admin), after a texting service is approved
create function public.coach_message_settings_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.dragonfly_is_admin()
     and ((tg_op = 'INSERT' and new.sms_enabled) or (tg_op = 'UPDATE' and new.sms_enabled is distinct from old.sms_enabled)) then
    raise exception 'owner_only_setting' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger coach_message_settings_guard before insert or update on public.coach_message_settings for each row execute function public.coach_message_settings_guard();
revoke execute on function public.coach_message_settings_guard() from public, anon, authenticated;
create policy coach_message_settings_admin on public.coach_message_settings for all to authenticated
  using ((select public.dragonfly_is_admin())) with check ((select public.dragonfly_is_admin()));
create policy coach_outbox_trainer on public.coach_outbox for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_outbox_client on public.coach_outbox for select to authenticated
  using (status = 'sent' and public.coach_is_client(client_id));
create policy coach_inbox_trainer on public.coach_inbox for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));

-- Deliver a message into the trainer–client Dragonfly chat (service role only; used by coach-outbox)
create function public.coach_outbox_deliver_app(p_outbox uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare o public.coach_outbox%rowtype; cu uuid; ch uuid;
begin
  select * into o from public.coach_outbox where id = p_outbox;
  select user_id into cu from public.coach_clients where id = o.client_id and status = 'active';
  if cu is null then return false; end if;
  select c.id into ch from public.coach_chats c
   where c.kind = 'direct' and exists (select 1 from public.coach_chat_members m where m.chat_id = c.id and m.user_id = o.trainer_id)
     and exists (select 1 from public.coach_chat_members m where m.chat_id = c.id and m.user_id = cu)
   order by c.created_at limit 1;
  if ch is null then
    insert into public.coach_chats (trainer_id, kind, created_by) values (o.trainer_id, 'direct', o.trainer_id) returning id into ch;
    insert into public.coach_chat_members (chat_id, user_id, role, name) values
      (ch, o.trainer_id, 'trainer', public.coach_person_name(o.trainer_id, o.trainer_id)),
      (ch, cu, 'client', public.coach_person_name(cu, o.trainer_id));
  end if;
  insert into public.coach_messages (chat_id, sender, kind, body, meta) values (ch, o.trainer_id, 'text', o.body, jsonb_build_object('outbox', o.id, 'kind', o.kind));
  return true;
end $$;
revoke all on function public.coach_outbox_deliver_app(uuid) from public, anon, authenticated;
grant execute on function public.coach_outbox_deliver_app(uuid) to service_role;

-- Every 15 minutes: plan due messages and deliver queued ones
select cron.unschedule('coach-outbox') where exists (select 1 from cron.job where jobname = 'coach-outbox');
select cron.schedule('coach-outbox', '*/15 * * * *', $c$
  select net.http_post(
    url := 'https://fkksaivdznqbfsfsagsj.supabase.co/functions/v1/coach-outbox',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cron_secret')),
    body := '{"action":"run"}'::jsonb,
    timeout_milliseconds := 60000)
$c$);
