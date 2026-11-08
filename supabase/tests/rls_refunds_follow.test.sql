-- Sessions follow refunds: refunding a payment cancels the package it bought (used credits stay on record) and
-- releases a paid group-session place, moving the waiting list up. Other clients' purchases are untouched.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Emmet' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'ana@example.com' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Bo', 'bo@example.com' from t.ids where k = 'trainer';
insert into public.coach_payments (trainer_id, client_id, description, amount_cents, status, method)
  select trainer_id, id, '10 sessions', 60000, 'paid', 'card' from public.coach_clients where first_name in ('Ana', 'Bo');
insert into public.coach_client_packages (trainer_id, client_id, name, credits_total, credits_used, payment_id)
  select p.trainer_id, p.client_id, '10 sessions', 10, 3, p.id from public.coach_payments p;
insert into public.coach_events (trainer_id, title, starts_at, spaces, waitlist, price_cents)
  select v, 'Small-group TRX', now() + interval '3 days', 1, true, 2000 from t.ids where k = 'trainer';
insert into public.coach_payments (trainer_id, client_id, description, amount_cents, status, method, event_id)
  select c.trainer_id, c.id, 'TRX class', 2000, 'paid', 'card', e.id from public.coach_clients c, public.coach_events e where c.first_name = 'Ana';
insert into public.coach_event_signups (event_id, client_id, trainer_id, status, paid)
  select e.id, c.id, c.trainer_id, 'booked', true from public.coach_events e, public.coach_clients c where c.first_name = 'Ana';
insert into public.coach_event_signups (event_id, client_id, trainer_id, status, paid)
  select e.id, c.id, c.trainer_id, 'waitlist', false from public.coach_events e, public.coach_clients c where c.first_name = 'Bo';

update public.coach_payments set status = 'refunded' where description = '10 sessions' and client_id = (select id from public.coach_clients where first_name = 'Ana');
select t.ok((select status = 'cancelled' and credits_used = 3 from public.coach_client_packages where client_id = (select id from public.coach_clients where first_name = 'Ana')), 'the refunded package is cancelled; used credits stay on record');
select t.ok((select status = 'active' from public.coach_client_packages where client_id = (select id from public.coach_clients where first_name = 'Bo')), 'other clients'' packages are untouched');
select t.ok((select count(*) from public.coach_client_packages) = 2, 'nothing is deleted');

update public.coach_payments set status = 'refunded' where description = 'TRX class';
select t.ok((select status from public.coach_event_signups where client_id = (select id from public.coach_clients where first_name = 'Ana')) = 'cancelled', 'a refunded class place is released');
select t.ok((select status from public.coach_event_signups where client_id = (select id from public.coach_clients where first_name = 'Bo')) = 'waitlist', 'a paid class: the next person is told and pays to take it (stays on the list)');
select t.ok((select booked from public.coach_events) = 0, 'the class count updates');
\echo ALL REFUNDS-FOLLOW TESTS PASSED
