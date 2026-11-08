-- Texting needs an explicit yes (carrier rules for toll-free and 10DLC; owner registering the Dragonfly number
-- 2026-11-07). Email and in-app reminders stay on by default; texts are sent only after the client ticks the
-- (unticked) box in sign-up or turns on "By text" in Messages. Each yes gets a confirmation text that says who it's
-- from, how often, rates, HELP and STOP.
create or replace function public.coach_contact_allowed(p_client uuid, p_purpose text, p_channel text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select c.granted from public.coach_contact_consents c
      where c.client_id = p_client and c.purpose = p_purpose and c.channel = p_channel
      order by c.created_at desc, c.id desc limit 1),
    p_purpose in ('reminders', 'offers') and p_channel <> 'sms')
$$;

-- The client says yes to texts (reminders and open spots by default): records consent and queues the confirmation
create function public.coach_sms_opt_in(p_client uuid, p_purposes text[] default array['reminders', 'offers'], p_text_version int default 3) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.coach_clients%rowtype; who text; already boolean;
begin
  select * into c from public.coach_clients where id = p_client;
  if not found or not public.coach_is_client(p_client) then raise exception 'not_you' using errcode = '42501'; end if;
  if coalesce(trim(c.phone), '') = '' then raise exception 'add_phone' using errcode = '22023'; end if;
  if not (p_purposes <@ array['reminders', 'offers', 'surveys', 'marketing']) or cardinality(p_purposes) = 0 then raise exception 'bad_purpose' using errcode = '22023'; end if;
  already := exists (select 1 from unnest(p_purposes) pu where public.coach_contact_allowed(p_client, pu, 'sms'));
  insert into public.coach_contact_consents (client_id, purpose, channel, granted, text_version, source)
    select p_client, pu, 'sms', true, p_text_version, 'client' from unnest(p_purposes) pu;
  if already then return; end if;
  select coalesce(nullif(trim(business_name), ''), display_name, 'your trainer') into who from public.coach_trainers where user_id = c.trainer_id;   -- business name, not a personal one
  insert into public.coach_outbox (trainer_id, client_id, purpose, kind, channel, body, dedupe_key)
  values (c.trainer_id, c.id, 'reminders', 'note', 'sms',
    'You''re signed up for training texts from ' || who || ' (reminders and open spots). Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.',
    'optin:' || c.id || ':' || to_char(now(), 'YYYYMMDDHH24MI'))
  on conflict (dedupe_key) do nothing;
end $$;
-- Reminder plan (owner 2026-11-07): main reminder ~48 h ahead, a 24-hour check if not confirmed, and the morning-of
alter table public.coach_message_settings alter column reminder_hours set default '{48,24,2}';

revoke execute on function public.coach_sms_opt_in(uuid, text[], int) from public, anon;
grant execute on function public.coach_sms_opt_in(uuid, text[], int) to authenticated;

-- A text the system can't act on is posted into the client's chat with their trainer, as the client (owner 2026-11-08:
-- "this number is automated and your message was sent via the in-app chat"). Returns false if the client has no app account.
create function public.coach_sms_to_chat(p_client uuid, p_body text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare cl public.coach_clients%rowtype; ch uuid;
begin
  select * into cl from public.coach_clients where id = p_client and status = 'active';
  if cl.user_id is null then return false; end if;
  select c.id into ch from public.coach_chats c
   where c.kind = 'direct' and exists (select 1 from public.coach_chat_members m where m.chat_id = c.id and m.user_id = cl.trainer_id)
     and exists (select 1 from public.coach_chat_members m where m.chat_id = c.id and m.user_id = cl.user_id)
   order by c.created_at limit 1;
  if ch is null then
    insert into public.coach_chats (trainer_id, kind, created_by) values (cl.trainer_id, 'direct', cl.trainer_id) returning id into ch;
    insert into public.coach_chat_members (chat_id, user_id, role, name) values
      (ch, cl.trainer_id, 'trainer', public.coach_person_name(cl.trainer_id, cl.trainer_id)),
      (ch, cl.user_id, 'client', public.coach_person_name(cl.user_id, cl.trainer_id));
  end if;
  insert into public.coach_messages (chat_id, sender, kind, body, meta)
  values (ch, cl.user_id, 'text', left(coalesce(nullif(trim(p_body), ''), '(empty text)'), 2000), jsonb_build_object('via', 'sms'));
  return true;
end $$;
revoke all on function public.coach_sms_to_chat(uuid, text) from public, anon, authenticated;
grant execute on function public.coach_sms_to_chat(uuid, text) to service_role;
