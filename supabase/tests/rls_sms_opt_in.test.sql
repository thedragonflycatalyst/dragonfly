-- Texts need an explicit yes: off by default (email and app stay on), the client's yes is recorded and confirmed by text.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('ana', gen_random_uuid()), ('bo', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name, timezone) select v, 'Emmet Smith', 'America/New_York' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email, phone) select v, 'Ana', 'ana@example.com', '410-555-0101' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Bo', 'bo@example.com' from t.ids where k = 'trainer';
select t.as_admin();
insert into t.ids select 'c_ana', id from public.coach_clients where first_name = 'Ana';
insert into t.ids select 'c_bo', id from public.coach_clients where first_name = 'Bo';
select t.as_user('ana'); select public.coach_link_me();
select t.as_user('bo'); select public.coach_link_me();
select t.as_user('ana');
select t.ok(not public.coach_contact_allowed((select v from t.ids where k = 'c_ana'), 'reminders', 'sms'), 'no texts until the client says yes');
select t.ok(public.coach_contact_allowed((select v from t.ids where k = 'c_ana'), 'reminders', 'email'), 'email reminders stay on by default');
select t.ok(t.refused($$select public.coach_sms_opt_in((select v from t.ids where k = 'c_bo'))$$), 'a client can''t opt someone else in');
select public.coach_sms_opt_in((select v from t.ids where k = 'c_ana'));
select t.ok(public.coach_contact_allowed((select v from t.ids where k = 'c_ana'), 'reminders', 'sms') and public.coach_contact_allowed((select v from t.ids where k = 'c_ana'), 'offers', 'sms'), 'yes turns on reminders and open spots by text');
select t.ok(not public.coach_contact_allowed((select v from t.ids where k = 'c_ana'), 'marketing', 'sms'), 'not marketing');
select public.coach_sms_opt_in((select v from t.ids where k = 'c_ana'));
select t.as_admin();
select t.ok((select count(*) from public.coach_outbox where body like 'You''re signed up for training texts from %Reply HELP for help, STOP to opt out.') = 1, 'one confirmation text with HELP and STOP');
select t.as_user('bo');
select t.ok(t.refused($$select public.coach_sms_opt_in((select v from t.ids where k = 'c_bo'))$$), 'no phone number, no texts');
select 'ALL SMS OPT-IN TESTS PASSED';
