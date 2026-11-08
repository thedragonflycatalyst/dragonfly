-- Open survey link (one per trainer, QR-friendly) and cancelling by text.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('ana', gen_random_uuid()), ('stranger', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name, timezone) select v, 'Emmet', 'America/New_York' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'ana@example.com' from t.ids where k = 'trainer';
create temp table code as select public.coach_survey_link() as c;
grant select on code to authenticated, anon;
select t.ok((select c from code) ~ '^[a-z0-9]{8}$', 'the trainer gets a survey code');
select t.ok(public.coach_survey_link() = (select c from code), 'the same code until they ask for a new one');
select t.ok(t.refused($$update public.coach_survey_links set code = 'abcdefgh'$$), 'the code can''t be set by hand');
update public.coach_survey_links set question = 'How was class tonight?';
select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
select t.ok((select count(*) from public.coach_survey_links) = 0, 'other trainers don''t see it');
select t.as_admin();
insert into t.ids select 'c_ana', id from public.coach_clients where first_name = 'Ana';
select t.as_user('ana'); select public.coach_link_me();

-- Signed-in client: answered as themselves, once a day
select t.ok((select question = 'How was class tonight?' and client_first = 'Ana' from public.coach_open_survey_view((select c from code))), 'the client sees the question and is recognised');
select t.ok(public.coach_open_survey_answer((select c from code), 4, 'Good', 'Someone else') = 'saved', 'a client answers');
select t.ok(public.coach_open_survey_answer((select c from code), 5, 'Great') = 'updated', 'a second answer the same day updates it');
select t.ok((select count(*) from public.coach_survey_responses) = 1 and (select rating from public.coach_survey_responses) = 5, 'the client sees their one answer');
select t.ok((select name is null from public.coach_survey_responses), 'a name isn''t stored for a known client');
-- Anyone else: anonymous, optional name
select t.as_admin(); set role anon;
select t.ok((select client_first is null from public.coach_open_survey_view((select c from code))), 'a visitor sees the survey');
select t.ok(public.coach_open_survey_answer((select c from code), 3, 'Ok', 'Sam') = 'saved', 'and answers without signing in');
select t.ok(t.refused($$select public.coach_open_survey_answer((select c from code), 7, null)$$), 'ratings are 1 to 5');
select t.ok(t.refused($$select public.coach_open_survey_answer('nope1234', 3, null)$$), 'a wrong code fails');
select t.ok(t.refused($$select count(*) from public.coach_survey_responses$$), 'visitors can''t read answers');
reset role;
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_survey_responses where source = 'open') = 2, 'the trainer sees both answers');
select t.ok((select name from public.coach_survey_responses where client_id is null) = 'Sam', 'with the visitor''s name');
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_survey_responses) = 0, 'other trainers see none');
-- A new code retires the old one
select t.as_user('trainer');
select t.ok(public.coach_survey_link(true) <> (select c from code), 'a new link replaces the old one');
select t.as_admin(); set role anon;
select t.ok((select count(*) from public.coach_open_survey_view((select c from code))) = 0, 'the old QR code stops working');
reset role;

-- Cancel by text: only the server; follows the notice period
select t.as_user('trainer');
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min) select (select v from t.ids where k = 'trainer'), v, 'Far', now() + interval '3 days', 60 from t.ids where k = 'c_ana';
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min) select (select v from t.ids where k = 'trainer'), v, 'Near', now() + interval '2 hours', 60 from t.ids where k = 'c_ana';
select t.as_user('ana');
select t.ok(t.refused($$select public.coach_cancel_by_text((select id from public.coach_bookings where title = 'Far'), current_date, (select v from t.ids where k = 'c_ana'))$$), 'clients can''t call the text-cancel function');
select t.as_admin();
select t.ok((public.coach_cancel_by_text((select id from public.coach_bookings where title = 'Near'), ((now() + interval '2 hours') at time zone 'America/New_York')::date, (select v from t.ids where k = 'c_ana')) ->> 'status') = 'too_late', 'inside the notice period it isn''t cancelled');
select t.ok((public.coach_cancel_by_text((select id from public.coach_bookings where title = 'Far'), ((now() + interval '3 days') at time zone 'America/New_York')::date, (select v from t.ids where k = 'c_ana')) ->> 'status') = 'cancelled', 'outside it, it is');
select t.ok((select skipped <> '{}' from public.coach_bookings where title = 'Far'), 'the trainer-booked session is skipped for that day');
select t.ok((public.coach_cancel_by_text((select id from public.coach_bookings where title = 'Far'), current_date + 30, (select v from t.ids where k = 'c_ana')) ->> 'status') = 'no_session', 'no session that day');
update public.coach_trainers set client_perms = client_perms || '{"cancel_sessions": false}';
select t.ok((public.coach_cancel_by_text((select id from public.coach_bookings where title = 'Near'), ((now() + interval '2 hours') at time zone 'America/New_York')::date, (select v from t.ids where k = 'c_ana')) ->> 'status') = 'not_allowed', 'trainers who don''t let clients cancel get not_allowed');
select 'ALL OPEN-SURVEY TESTS PASSED';
