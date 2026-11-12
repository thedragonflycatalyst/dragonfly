-- Session billing (owner rules 2026-11-07): packages first, then single sessions; outstanding sessions block client
-- booking; a package bought later covers them; cancelling gives back what paid; cards on file aren't marked due before
-- they're charged; trainers settle or waive by hand; rescheduling rules; reviews any time; refunds none by default.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('ana', gen_random_uuid()), ('bo', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name, timezone, stripe_account) select v, 'Emmet', 'America/New_York', 'acct_FAKE1' from t.ids where k = 'trainer';
select t.ok((select stripe_account is null and session_billing = 'app' from public.coach_trainers), 'a new trainer bills sessions in the app and can''t set a Stripe account themselves');
select t.ok(t.refused($$update public.coach_trainers set stripe_account = 'acct_FAKE2'$$), 'only Stripe (the server) connects an account');
update public.coach_trainers set single_session_cents = 8000;
insert into public.coach_availability (trainer_id, weekday, start_time, end_time) select v, d, '06:00', '20:00' from t.ids, generate_series(0, 6) d where k = 'trainer';
update public.coach_trainers set client_perms = client_perms || '{"book_sessions": true}';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'ana@example.com' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Bo', 'bo@example.com' from t.ids where k = 'trainer';
select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
select t.as_admin();
insert into t.ids select 'c_ana', id from public.coach_clients where first_name = 'Ana';
insert into t.ids select 'c_bo', id from public.coach_clients where first_name = 'Bo';
create table t.day as select (current_date + 5) as d;
grant select on t.day to authenticated, anon;
create function t.at(p_days int, p_time time) returns timestamptz language sql stable as $$ select ((current_date + p_days) + p_time) at time zone 'America/New_York' $$;
grant execute on function t.at(int, time) to authenticated, anon;
select t.as_user('ana'); select public.coach_link_me();
select t.as_user('bo'); select public.coach_link_me();

-- Ana has a 2-session package; three sessions: two use it, the third is a single session
select t.as_user('trainer');
insert into public.coach_client_packages (trainer_id, client_id, name, credits_total) select (select v from t.ids where k = 'trainer'), v, '2 sessions', 2 from t.ids where k = 'c_ana';
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min)
  select (select v from t.ids where k = 'trainer'), v, 'S' || n, t.at(n, '08:00'), 60 from t.ids, generate_series(2, 4) n where k = 'c_ana';
select t.ok((select array_agg(status order by starts_at) from public.coach_session_charges) = array['package', 'package', 'pending'], 'two sessions use the package; the third is a single session');
select t.ok((select amount_cents from public.coach_session_charges where status = 'pending') = 8000, 'at the trainer''s single-session price');
select t.ok((select credits_used from public.coach_client_packages) = 2, 'the package is used up');

-- Cancelling a package session gives the session back
delete from public.coach_bookings where title = 'S2';
select t.ok((select credits_used from public.coach_client_packages) = 1, 'cancelling gives the package session back');
select t.ok((select count(*) from public.coach_session_charges where status = 'cancelled') = 1, 'and the charge is marked cancelled');

-- The single session happens without payment (no card): it's outstanding and blocks client booking
select t.as_admin();
update public.coach_session_charges set starts_at = now() - interval '1 hour' where status = 'pending';
select public.coach_session_charges_tick();
select t.ok((select count(*) from public.coach_session_charges where status = 'due') = 1, 'a session that happened unpaid is outstanding');
select t.as_user('ana');
select t.ok((select count(*) from public.coach_session_charges where status = 'due') = 1, 'the client sees what they owe');
select t.ok(t.refused($$select public.coach_book_session((select v from t.ids where k = 'trainer'), t.at(6, '09:00'), 60)$$), 'a client with an outstanding session can''t book another');
select t.ok(t.refused($$select public.coach_charge_settle((select id from public.coach_session_charges where status = 'due'), 'waived')$$), 'clients can''t settle their own charges');

-- A package bought afterwards covers it (the earlier package also had one session back)
select t.as_user('trainer');
select t.ok((select status from public.coach_session_charges where status in ('due', 'package') and starts_at < now()) = 'due', 'still due before a package');
update public.coach_client_packages set credits_used = 2;
insert into public.coach_client_packages (trainer_id, client_id, name, credits_total) select (select v from t.ids where k = 'trainer'), v, '5 sessions', 5 from t.ids where k = 'c_ana';
select t.ok((select status from public.coach_session_charges where starts_at < now()) = 'package', 'a new package pays for the outstanding session');
select t.as_user('ana');
select t.ok(public.coach_book_session((select v from t.ids where k = 'trainer'), t.at(6, '09:00'), 60) is not null, 'then the client can book again');
select t.ok((select status from public.coach_session_charges where starts_at = t.at(6, '09:00')) = 'package', 'their new booking uses the package');

-- A client with a card on file isn't marked outstanding before the card is tried
select t.as_user('trainer');
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min) select (select v from t.ids where k = 'trainer'), v, 'Bo1', t.at(3, '12:00'), 60 from t.ids where k = 'c_bo';
select t.as_admin();
insert into public.coach_client_cards (client_id, trainer_id, stripe_customer, payment_method, brand, last4) select v, (select v from t.ids where k = 'trainer'), 'cus_X', 'pm_X', 'visa', '4242' from t.ids where k = 'c_bo';
update public.coach_session_charges set starts_at = now() - interval '1 hour' where client_id = (select v from t.ids where k = 'c_bo');
select public.coach_session_charges_tick();
select t.ok((select status from public.coach_session_charges where client_id = (select v from t.ids where k = 'c_bo')) = 'pending', 'a card on file is charged first, not marked outstanding');
update public.coach_session_charges set attempts = 1 where client_id = (select v from t.ids where k = 'c_bo');
select public.coach_session_charges_tick();
select t.ok((select status from public.coach_session_charges where client_id = (select v from t.ids where k = 'c_bo')) = 'due', 'if the card fails it becomes outstanding');
select t.as_user('bo');
select t.ok(t.refused($$update public.coach_client_cards set last4 = '0000'$$) or (select last4 from public.coach_client_cards) = '4242', 'clients can''t edit card records');
select t.as_user('trainer');
select public.coach_charge_settle((select id from public.coach_session_charges where client_id = (select v from t.ids where k = 'c_bo')), 'paid', 'cash', 'Paid at the desk');
select t.ok((select status = 'paid' and payment_id is not null from public.coach_session_charges where client_id = (select v from t.ids where k = 'c_bo')), 'the trainer records a cash payment');
select t.ok((select count(*) from public.coach_payments where method = 'cash' and amount_cents = 8000) = 1, 'and it shows in payments');
select t.ok(t.refused($$delete from public.coach_client_cards$$) or (select count(*) from public.coach_client_cards) = 1, 'trainers can''t remove a client''s card');

-- Other trainers see nothing
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_session_charges) = 0 and (select count(*) from public.coach_client_cards) = 0, 'other trainers see no charges or cards');
select t.ok(t.refused($$select public.coach_charge_settle((select id from public.coach_session_charges limit 1), 'waived')$$), 'or settle them');

-- Rescheduling: more than 24 hours ahead, to another day; within 24 hours, same day only. A client's move into an
-- open time happens at once (owner 2026-11-12); the trainer is told.
select t.as_user('ana');
select t.ok(public.coach_reschedule_session((select id from public.coach_bookings where title = 'S3'), current_date + 3, t.at(5, '10:00')) is not null, 'a client moves a session to another day');
select t.ok((select starts_at from public.coach_bookings where title = 'S3') = t.at(5, '10:00'), 'it moves straight away');
select t.ok((select status = 'moved' and trainer_alerted_at is null and client_told_at is not null from public.coach_reschedule_requests where booking_id = (select id from public.coach_bookings where title = 'S3')), 'the move is recorded for the trainer to be told');
select t.ok((select count(*) from public.coach_appointment_log where action = 'moved' and via = 'app' and old_start = t.at(3, '08:00') and new_start = t.at(5, '10:00')) = 1, 'and kept in the history');
select t.ok((select starts_at from public.coach_session_charges where booking_id = (select id from public.coach_bookings where title = 'S3')) = t.at(5, '10:00'), 'what pays for it moves with it');
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_appointment_log where action = 'moved') = 1, 'the trainer sees the history');
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_appointment_log) = 0, 'other trainers don''t');
select t.ok(t.refused($$select public.coach_reschedule_session((select id from public.coach_bookings where title = 'S4'), current_date + 4, t.at(4, '13:00'))$$), 'or move other trainers'' sessions');
select t.as_admin();
select t.ok((select count(*) from public.coach_open_slots where starts_at = t.at(3, '08:00')) = 1, 'the old time goes to the waitlist');
-- A session tomorrow early morning (within 24 hours)
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min) select (select v from t.ids where k = 'trainer'), v, 'Soon', now() + interval '20 hours', 60 from t.ids where k = 'c_ana';
-- Exactly 24 hours away also counts as "within 24 hours"
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min) select (select v from t.ids where k = 'trainer'), v, 'Edge', date_trunc('minute', now()) + interval '24 hours', 30 from t.ids where k = 'c_ana';
select t.as_user('ana');
select t.ok(t.refused($$select public.coach_reschedule_session((select id from public.coach_bookings where title = 'Soon'), ((now() + interval '20 hours') at time zone 'America/New_York')::date, now() + interval '44 hours')$$), 'within 24 hours it can''t move to another day');
select t.ok(t.refused($$select public.coach_reschedule_session((select id from public.coach_bookings where title = 'S4'), current_date + 4, t.at(6, '09:00'))$$), 'can''t move onto a taken time');
select t.ok(t.refused($$select public.coach_reschedule_session((select id from public.coach_bookings where title = 'S4'), current_date + 4, t.at(4, '23:00'))$$), 'or outside the trainer''s hours');
select t.ok((select starts_at from public.coach_bookings where title = 'S4') = t.at(4, '08:00'), 'a refused move leaves the session where it was');
-- An old pending request (from before moves were automatic) can still be decided by the trainer
select t.as_admin();
insert into public.coach_reschedule_requests (booking_id, on_date, client_id, trainer_id, old_start, new_start, duration_min)
select b.id, current_date + 4, b.client_id, b.trainer_id, b.starts_at, t.at(4, '14:00'), 60 from public.coach_bookings b where b.title = 'S4';
select t.as_user('ana');
select t.ok(t.refused($$select public.coach_reschedule_decide((select id from public.coach_reschedule_requests where status = 'pending'), true)$$), 'clients can''t approve a request');
select t.as_user('trainer');
select public.coach_reschedule_decide((select id from public.coach_reschedule_requests where status = 'pending'), false, 'Fully booked then');
select t.ok((select starts_at from public.coach_bookings where title = 'S4') = t.at(4, '08:00'), 'a declined request leaves the session where it was');
-- A repeating session: one date moves; the rest stay
select t.as_user('trainer');
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min, repeat) select (select v from t.ids where k = 'trainer'), v, 'Weekly', t.at(8, '15:00'), 60, 'weekly' from t.ids where k = 'c_bo';
select t.ok(public.coach_reschedule_session((select id from public.coach_bookings where title = 'Weekly'), current_date + 8, t.at(8, '17:00')) is not null, 'the trainer moves one date of a weekly session');
select t.ok((select skipped from public.coach_bookings where title = 'Weekly' and repeat = 'weekly') = array[current_date + 8], 'that date is skipped on the weekly booking');
select t.ok((select count(*) from public.coach_bookings where title = 'Weekly' and repeat = 'none' and starts_at = t.at(8, '17:00')) = 1, 'and booked as a one-off at the new time');

-- Reviews any time
select t.as_user('ana');
select t.ok(public.coach_my_testimonial((select v from t.ids where k = 'trainer')) = public.coach_my_testimonial((select v from t.ids where k = 'trainer')), 'a client gets one review link any time (the same one until it''s used)');
select t.ok(t.refused($$select public.coach_my_testimonial((select v from t.ids where k = 'trainer2'))$$), 'only for their own trainer');

-- Refunds: none unless the trainer chooses otherwise
select t.ok((public.coach_refund_terms((select v from t.ids where k = 'trainer'), null) ->> 'mode') = 'none', 'no refunds by default');

-- Billing handled elsewhere (e.g. Columbia Association): nothing is attached
select t.as_user('trainer2');
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Cy', 'cy@example.com' from t.ids where k = 'trainer2';
update public.coach_trainers set session_billing = 'external';
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min) select (select v from t.ids where k = 'trainer2'), id, 'X', t.at(2, '08:00'), 60 from public.coach_clients where first_name = 'Cy';
select t.as_admin();
select t.ok((select count(*) from public.coach_session_charges where trainer_id = (select v from t.ids where k = 'trainer2')) = 0, 'trainers who bill elsewhere get no session charges');
-- A late cancellation by text keeps the package session used
select t.as_user('trainer');
insert into public.coach_client_packages (trainer_id, client_id, name, credits_total) select (select v from t.ids where k = 'trainer'), v, '10 sessions', 10 from t.ids where k = 'c_bo';
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min) select (select v from t.ids where k = 'trainer'), v, 'BoLate', now() + interval '3 hours', 60 from t.ids where k = 'c_bo';
select t.as_admin();
select t.ok((select status from public.coach_session_charges where booking_id = (select id from public.coach_bookings where title = 'BoLate')) = 'package', 'Bo''s session uses his package');
create temp table bo_used as select credits_used from public.coach_client_packages where name = '10 sessions';
select t.ok((public.coach_cancel_by_text((select id from public.coach_bookings where title = 'BoLate'), ((now() + interval '3 hours') at time zone 'America/New_York')::date, (select v from t.ids where k = 'c_bo')) ->> 'status') = 'late_cancelled', 'a late cancel by text');
select t.ok((select status = 'package' and note like 'Late cancellation%' from public.coach_session_charges where booking_id = (select id from public.coach_bookings where title = 'BoLate')), 'keeps the package session used');
select t.ok((select credits_used from public.coach_client_packages where name = '10 sessions') = (select credits_used from bo_used), 'and the credit isn''t returned');
select 'ALL SESSION-BILLING TESTS PASSED';
