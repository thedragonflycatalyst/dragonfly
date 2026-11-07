-- Messaging: consent belongs to the client (trainers can only record a withdrawal); trainers see and manage only
-- their own outbox; they can cancel or mark a manual text sent but not rewrite messages; SMS stays off unless the owner
-- turns it on; chat delivery puts the message in the trainer–client chat.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('ana', gen_random_uuid()), ('boss', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
insert into public.dragonfly_admins select v from t.ids where k = 'boss';
set client_min_messages = notice;

select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Emmet' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'ana@example.com' from t.ids where k = 'trainer';
select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
select t.as_admin(); insert into t.ids select 'c_ana', id from public.coach_clients where first_name = 'Ana';
select t.as_user('ana'); select public.coach_link_me();

-- Consent
select t.as_user('trainer');
select t.ok(t.refused($$insert into public.coach_contact_consents (client_id, purpose, channel, granted) select v, 'marketing', 'sms', true from t.ids where k = 'c_ana'$$), 'a trainer can''t give consent for a client');
insert into public.coach_contact_consents (client_id, purpose, channel, granted) select v, 'marketing', 'sms', false from t.ids where k = 'c_ana';
select t.ok((select source from public.coach_contact_consents) = 'trainer', 'a trainer can record a withdrawal');
select t.as_user('ana');
insert into public.coach_contact_consents (client_id, purpose, channel, granted) select v, 'reminders', 'sms', true from t.ids where k = 'c_ana';
select t.ok(public.coach_contact_allowed((select v from t.ids where k = 'c_ana'), 'reminders', 'sms'), 'the client opts in to text reminders');
select t.ok(not public.coach_contact_allowed((select v from t.ids where k = 'c_ana'), 'marketing', 'sms'), 'marketing by text stays off');
select t.ok(public.coach_contact_allowed((select v from t.ids where k = 'c_ana'), 'reminders', 'app'), 'chat reminders are on by default');
select t.ok(public.coach_contact_allowed((select v from t.ids where k = 'c_ana'), 'offers', 'email'), 'session messages are on by default on every channel');
insert into public.coach_contact_prefs (client_id, preferred_channel) select v, 'email' from t.ids where k = 'c_ana';
select t.ok((select preferred_channel from public.coach_contact_prefs) = 'email', 'the client picks how to be reached');
insert into public.coach_contact_consents (client_id, purpose, channel, granted) select v, 'reminders', 'email', false from t.ids where k = 'c_ana';
select t.ok(not public.coach_contact_allowed((select v from t.ids where k = 'c_ana'), 'reminders', 'email'), 'and can switch a channel off');
select t.ok(not public.coach_contact_allowed((select v from t.ids where k = 'c_ana'), 'surveys', 'app'), 'surveys need a yes even in chat');
select t.ok(t.refused($$update public.coach_contact_consents set granted = true$$), 'consent records can''t be edited');

-- Settings
select t.as_user('trainer');
select t.ok((select preferred_channel from public.coach_contact_prefs) = 'email', 'the trainer sees the client''s choice');
select t.ok(t.refused($$update public.coach_contact_prefs set preferred_channel = 'app'$$) or (select preferred_channel from public.coach_contact_prefs) = 'email', 'but can''t change it');
insert into public.coach_message_settings (trainer_id) select v from t.ids where k = 'trainer';
update public.coach_message_settings set surveys_on = true;
select t.ok((select surveys_on from public.coach_message_settings), 'trainers set their own messaging');
select t.ok(t.refused($$update public.coach_message_settings set sms_enabled = true$$), 'only the owner switches texting on');
select t.as_user('boss');
update public.coach_message_settings set sms_enabled = true where trainer_id = (select v from t.ids where k = 'trainer');
select t.as_user('trainer');
select t.ok((select sms_enabled from public.coach_message_settings), 'the owner switched texting on');
update public.coach_message_settings set max_per_week = 2;
select t.ok((select max_per_week = 2 from public.coach_message_settings), 'trainers still edit other settings after that');

-- Outbox
insert into public.coach_outbox (trainer_id, client_id, purpose, kind, channel, body, status) select (select v from t.ids where k = 'trainer'), v, 'reminders', 'reminder', 'manual', 'Reminder: training tomorrow 7:00 AM', 'sent' from t.ids where k = 'c_ana';
select t.ok((select status from public.coach_outbox) = 'queued', 'new messages always start queued');
select t.ok(t.refused($$update public.coach_outbox set body = 'something else'$$), 'queued messages can''t be rewritten');
update public.coach_outbox set status = 'sent';
select t.ok((select status = 'sent' and sent_at is not null from public.coach_outbox), 'a manual text can be marked sent');
select t.ok(t.refused($$update public.coach_outbox set status = 'queued'$$), 'a sent message stays sent');
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_outbox) = 0, 'other trainers see nothing');
select t.ok(t.refused($$insert into public.coach_outbox (trainer_id, client_id, purpose, kind, channel, body) select (select v from t.ids where k = 'trainer2'), v, 'marketing', 'note', 'manual', 'hi' from t.ids where k = 'c_ana'$$), 'nobody messages someone else''s client');
select t.as_user('ana');
select t.ok((select count(*) from public.coach_outbox) = 1, 'the client sees messages sent to them');

-- Chat delivery (service role)
select t.as_admin();
insert into public.coach_outbox (trainer_id, client_id, purpose, kind, channel, body) select (select v from t.ids where k = 'trainer'), v, 'reminders', 'reminder', 'app', 'See you tomorrow' from t.ids where k = 'c_ana';
select t.ok(public.coach_outbox_deliver_app((select id from public.coach_outbox where channel = 'app')), 'chat delivery works');
select t.ok((select count(*) from public.coach_messages where body = 'See you tomorrow') = 1, 'the message is in their chat');
select t.as_user('trainer');
select t.ok(t.refused($$select public.coach_outbox_deliver_app((select id from public.coach_outbox where channel = 'app'))$$), 'only the server delivers');
set role anon;
select t.ok(t.refused($$select count(*) from public.coach_outbox$$), 'signed-out visitors are refused');
\echo ALL MESSAGING TESTS PASSED
