-- A trainer refunds one charged session (owner 2026-11-12): package sessions go back on the package, unpaid ones are let
-- go, cash payments are recorded as given back (only this session's share), card payments go through coach-pay.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('ana', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name, timezone) select v, 'Emmet', 'America/New_York' from t.ids where k = 'trainer';
update public.coach_trainers set single_session_cents = 8000;
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'ana@example.com' from t.ids where k = 'trainer';
select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
select t.as_admin();
insert into t.ids select 'c_ana', id from public.coach_clients where first_name = 'Ana';
select t.as_user('ana'); select public.coach_link_me();

-- A 1-session package, then four single sessions
select t.as_user('trainer');
insert into public.coach_client_packages (trainer_id, client_id, name, credits_total) select (select v from t.ids where k = 'trainer'), v, '1 session', 1 from t.ids where k = 'c_ana';
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min)
  select (select v from t.ids where k = 'trainer'), v, 'S' || n, date_trunc('hour', now()) + make_interval(days => n), 60 from t.ids, generate_series(1, 5) n where k = 'c_ana';
create temp table ch as select c.id, b.title from public.coach_session_charges c join public.coach_bookings b on b.id = c.booking_id;
grant select on ch to authenticated;
select t.ok((select status from public.coach_session_charges where id = (select id from ch where title = 'S1')) = 'package', 'the first session uses the package');

-- Package session: back on the package
select t.ok(t.refused($$select public.coach_charge_refund((select id from ch where title = 'S1'), '')$$), 'a reason is required');
select t.ok((public.coach_charge_refund((select id from ch where title = 'S1'), 'Gym closed for a storm')->>'what') = 'credit', 'a package session is refunded as a session back');
select t.ok((select credits_used from public.coach_client_packages) = 0, 'the package has its session back');
select t.ok((select status = 'refunded' and refund_reason ~ 'storm' and refunded_by = auth.uid() from public.coach_session_charges where id = (select id from ch where title = 'S1')), 'kept with the reason and who did it');
select t.ok(t.refused($$select public.coach_charge_refund((select id from ch where title = 'S1'), 'again')$$), 'it can''t be refunded twice');

-- Not paid yet: let go
select t.ok((public.coach_charge_refund((select id from ch where title = 'S2'), 'My mistake')->>'what') = 'waived', 'an unpaid session is let go');
select t.ok((select status from public.coach_session_charges where id = (select id from ch where title = 'S2')) = 'waived', 'nothing is owed for it');

-- Paid in cash: recorded as given back
select public.coach_charge_settle((select id from ch where title = 'S3'), 'paid', 'cash');
select t.ok((public.coach_charge_refund((select id from ch where title = 'S3'), 'Client was sick')->>'what') = 'money', 'a cash session is refunded');
select t.ok((select status = 'refunded' and refunded_cents = 8000 from public.coach_payments where id = (select payment_id from public.coach_session_charges where id = (select id from ch where title = 'S3'))), 'the payment shows the money given back');

-- One payment for two sessions: only this session's share
select t.as_admin();
insert into public.coach_payments (trainer_id, client_id, description, amount_cents, currency, status, method)
  select (select v from t.ids where k = 'trainer'), v, '2 outstanding sessions', 16000, 'usd', 'paid', 'transfer' from t.ids where k = 'c_ana';
update public.coach_session_charges set status = 'paid', payment_id = (select id from public.coach_payments where amount_cents = 16000) where id in (select id from ch where title in ('S4', 'S5'));
select t.as_user('trainer');
select public.coach_charge_refund((select id from ch where title = 'S4'), 'Late cancel forgiven');
select t.ok((select status = 'paid' and refunded_cents = 8000 from public.coach_payments where amount_cents = 16000), 'a shared payment is refunded only for that session');
select t.ok((select status from public.coach_session_charges where id = (select id from ch where title = 'S5')) = 'paid', 'the other session stays paid');

-- Paid by card: the app has to go through coach-pay (Stripe), and only coach-pay can finish it
select t.as_admin();
update public.coach_payments set method = 'stripe', stripe_payment_intent = 'pi_test_1' where amount_cents = 16000;
select t.as_user('trainer');
select t.ok(t.refused($$select public.coach_charge_refund((select id from ch where title = 'S5'), 'Card refund')$$), 'a card session must be refunded to the card');
select t.ok((select status from public.coach_session_charges where id = (select id from ch where title = 'S5')) = 'paid', 'and nothing changes until it is');
select t.ok(t.refused($$select public.coach_charge_refund_apply((select id from ch where title = 'S5'), 'x', auth.uid(), true)$$), 'the finishing step is server-only');

-- Nobody else
select t.as_user('trainer2');
select t.ok(t.refused($$select public.coach_charge_refund((select id from ch where title = 'S5'), 'Not mine')$$), 'other trainers can''t refund');
select t.as_user('ana');
select t.ok(t.refused($$select public.coach_charge_refund((select id from ch where title = 'S5'), 'Give it back')$$), 'clients can''t refund themselves');
select t.ok((select count(*) from public.coach_session_charges where status = 'refunded') = 3, 'the client sees which sessions were refunded');
select 'ALL REFUND-SESSION TESTS PASSED';
