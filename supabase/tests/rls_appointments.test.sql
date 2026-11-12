-- Client appointments (issue #56): cancelling in the app follows the notice period (inside it, or exactly at it, the
-- session is still cancelled but counts as one); moves into open times happen at once; everything is in the history.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('ana', gen_random_uuid()), ('bo', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name, timezone, cancel_hours) select v, 'Emmet', 'America/New_York', 24 from t.ids where k = 'trainer';
update public.coach_trainers set single_session_cents = 8000, client_perms = client_perms || '{"book_sessions": true, "cancel_sessions": true}';
insert into public.coach_availability (trainer_id, weekday, start_time, end_time) select v, d, '00:00', '23:59' from t.ids, generate_series(0, 6) d where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'ana@example.com' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Bo', 'bo@example.com' from t.ids where k = 'trainer';
select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
select t.as_admin();
insert into t.ids select 'c_ana', id from public.coach_clients where first_name = 'Ana';
insert into t.ids select 'c_bo', id from public.coach_clients where first_name = 'Bo';
create function t.local_day(ts timestamptz) returns date language sql stable as $$ select (ts at time zone 'America/New_York')::date $$;
grant execute on function t.local_day(timestamptz) to authenticated;
select t.as_user('ana'); select public.coach_link_me();
select t.as_user('bo'); select public.coach_link_me();

-- Sessions for Ana (no package, so each is a single session): far ahead, inside 24 hours, and one booked by herself
select t.as_user('trainer');
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min)
  select (select v from t.ids where k = 'trainer'), v, x.title, x.at, 60 from t.ids,
  (values ('Far', date_trunc('hour', now()) + interval '3 days'), ('Near', date_trunc('hour', now()) + interval '10 hours')) x(title, at) where k = 'c_ana';
select t.as_user('ana');
select t.ok(public.coach_book_session((select v from t.ids where k = 'trainer'), date_trunc('hour', now()) + interval '5 days', 60) is not null, 'a client books an open time');
select t.ok((select count(*) from public.coach_appointment_log where action = 'booked' and via = 'app') = 1, 'the booking is in her history');
select t.ok(t.refused($$select public.coach_book_session((select v from t.ids where k = 'trainer'), date_trunc('hour', now()) + interval '5 days', 60)$$), 'the same time can''t be booked twice');

-- More than 24 hours ahead: cancelled, nothing owed
select t.ok((select public.coach_cancel_session((select id from public.coach_bookings where title = 'Far'), t.local_day(date_trunc('hour', now()) + interval '3 days'))->>'status') = 'cancelled', 'more than 24 hours ahead: a normal cancellation');
select t.ok((select status from public.coach_session_charges where starts_at = date_trunc('hour', now()) + interval '3 days') = 'cancelled', 'nothing is owed for it');
select t.ok(t.refused($$select public.coach_cancel_session((select id from public.coach_bookings where title = 'Far'), t.local_day(date_trunc('hour', now()) + interval '3 days'))$$), 'cancelling the same session again is refused');
select t.ok((select count(*) from public.coach_appointment_log where action = 'cancelled') = 1, 'and recorded once');

-- Inside 24 hours: still cancelled, but it counts as a session
select t.ok((select public.coach_cancel_session((select id from public.coach_bookings where title = 'Near'), t.local_day(date_trunc('hour', now()) + interval '10 hours'))->>'status') = 'late_cancelled', 'inside 24 hours: a late cancellation');
select t.ok((select status = 'pending' and note ~ 'Late cancellation' from public.coach_session_charges where starts_at = date_trunc('hour', now()) + interval '10 hours'), 'what it costs is kept (charged once, like any session)');
select t.ok((select count(*) from public.coach_session_charges where starts_at = date_trunc('hour', now()) + interval '10 hours') = 1, 'one charge, not two');

-- Exactly 24 hours: late (one transaction, so "now" is the same instant)
select t.as_user('trainer');
begin;
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min) select (select v from t.ids where k = 'trainer'), v, 'Edge', now() + interval '24 hours', 60 from t.ids where k = 'c_ana';
select t.as_user('ana');
select t.ok((select public.coach_cancel_session((select id from public.coach_bookings where title = 'Edge'), t.local_day(now() + interval '24 hours'))->>'status') = 'late_cancelled', 'exactly 24 hours ahead counts as late');
commit;

-- A package session cancelled with notice gives the session back; late keeps it used
select t.as_user('trainer');
insert into public.coach_client_packages (trainer_id, client_id, name, credits_total) select (select v from t.ids where k = 'trainer'), v, '2 sessions', 2 from t.ids where k = 'c_bo';
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min)
  select (select v from t.ids where k = 'trainer'), v, x.title, x.at, 60 from t.ids,
  (values ('BoFar', date_trunc('hour', now()) + interval '4 days'), ('BoNear', date_trunc('hour', now()) + interval '6 hours')) x(title, at) where k = 'c_bo';
select t.ok((select credits_used from public.coach_client_packages) = 2, 'both of Bo''s sessions use his package');
select t.as_user('bo');
select public.coach_cancel_session((select id from public.coach_bookings where title = 'BoFar'), t.local_day(date_trunc('hour', now()) + interval '4 days'));
select public.coach_cancel_session((select id from public.coach_bookings where title = 'BoNear'), t.local_day(date_trunc('hour', now()) + interval '6 hours'));
select t.ok((select credits_used from public.coach_client_packages) = 1, 'the early cancellation gives one back; the late one stays used');

-- Nobody else can cancel or see them
select t.as_user('bo');
select t.ok(t.refused($$select public.coach_cancel_session((select id from public.coach_bookings where booked_by = 'client' limit 1), current_date + 5)$$), 'clients can''t cancel each other''s sessions');
select t.ok((select count(*) from public.coach_appointment_log where client_id = (select v from t.ids where k = 'c_ana')) = 0, 'or see each other''s history');
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_appointment_log) = 0, 'other trainers see no history');

-- Trainer switches off client cancelling: the app refuses (the text path says "message your trainer")
select t.as_user('trainer');
update public.coach_trainers set client_perms = client_perms || '{"cancel_sessions": false}';
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min) select (select v from t.ids where k = 'trainer'), v, 'Locked', date_trunc('hour', now()) + interval '6 days', 60 from t.ids where k = 'c_ana';
select t.as_user('ana');
select t.ok(t.refused($$select public.coach_cancel_session((select id from public.coach_bookings where title = 'Locked'), t.local_day(date_trunc('hour', now()) + interval '6 days'))$$), 'cancelling is off when the trainer turns it off');
select t.as_admin();
select t.ok((public.coach_cancel_by_text((select id from public.coach_bookings where title = 'Locked'), t.local_day(date_trunc('hour', now()) + interval '6 days'), (select v from t.ids where k = 'c_ana'))->>'status') = 'not_allowed', 'and by text');
update public.coach_trainers set client_perms = client_perms || '{"cancel_sessions": true}' where user_id = (select v from t.ids where k = 'trainer');
select t.ok((public.coach_cancel_by_text((select id from public.coach_bookings where title = 'Locked'), t.local_day(date_trunc('hour', now()) + interval '6 days'), (select v from t.ids where k = 'c_ana'))->>'status') = 'cancelled', 'cancelling by text follows the same rule');
select t.ok((select count(*) from public.coach_appointment_log where via = 'text') = 1, 'and is in the history as a text');

-- A weekly session that began before the clocks changed keeps its wall-clock time (time zone aware)
select t.as_user('trainer');
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min, repeat)
  select (select v from t.ids where k = 'trainer'), v, 'Weekly', timestamp '2026-10-20 07:00' at time zone 'America/New_York', 60, 'weekly' from t.ids where k = 'c_ana';
create temp table wk as select d from generate_series(current_date + 2, current_date + 8, interval '1 day') d where extract(dow from d) = 2;
grant select on wk to authenticated;
select t.as_user('ana');
select t.ok(((public.coach_cancel_session((select id from public.coach_bookings where title = 'Weekly'), (select d::date from wk))->>'starts_at')::timestamptz at time zone 'America/New_York')::time = '07:00', 'a weekly 7 AM session is still 7 AM after daylight saving ends');

-- Moving: into an open time it happens at once and the trainer is told; a refused move changes nothing
select t.as_user('trainer');
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min) select (select v from t.ids where k = 'trainer'), v, 'Move', date_trunc('hour', now()) + interval '8 days', 60 from t.ids where k = 'c_ana';
select t.as_user('ana');
select public.coach_reschedule_session((select id from public.coach_bookings where title = 'Move'), t.local_day(date_trunc('hour', now()) + interval '8 days'), date_trunc('hour', now()) + interval '9 days');
select t.ok((select starts_at from public.coach_bookings where title = 'Move') = date_trunc('hour', now()) + interval '9 days', 'moved at once');
select t.ok((select count(*) from public.coach_reschedule_requests where status = 'moved') = 1, 'the trainer is told');
select t.ok(t.refused($$select public.coach_reschedule_session((select id from public.coach_bookings where title = 'Move'), t.local_day(date_trunc('hour', now()) + interval '9 days'), date_trunc('hour', now()) + interval '5 days')$$), 'can''t move onto another session');
select t.ok((select starts_at from public.coach_bookings where title = 'Move') = date_trunc('hour', now()) + interval '9 days', 'the failed move leaves it in place');
select t.ok(t.refused($$select public.coach_cancel_occurrence((select id from public.coach_bookings where title = 'Move'), current_date + 9, 'app')$$), 'the inner cancel isn''t callable directly');
select 'ALL APPOINTMENT TESTS PASSED';
