-- Refund policy: the policy at purchase is copied onto the package; quotes are prorated by sessions used, minus the
-- fee; clear reasons when a refund isn't permitted; outside-policy refunds are flagged; others can't see quotes.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('ana', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Emmet' from t.ids where k = 'trainer';
insert into public.coach_refund_policies (trainer_id, mode, window_days, fee_cents) select v, 'prorated', 30, 500 from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'ana@example.com' from t.ids where k = 'trainer';
insert into public.coach_packages (trainer_id, name, price_cents, credits) select v, '10 sessions', 60000, 10 from t.ids where k = 'trainer';
insert into public.coach_packages (trainer_id, name, price_cents, credits, refund_mode) select v, 'Intro special', 9900, 3, 'none' from t.ids where k = 'trainer';
insert into public.coach_payments (trainer_id, client_id, description, amount_cents, status, method, package_id)
  select p.trainer_id, c.id, p.name, p.price_cents, 'paid', 'card', p.id from public.coach_packages p, public.coach_clients c;
insert into public.coach_client_packages (trainer_id, client_id, package_id, name, credits_total, credits_used, payment_id)
  select py.trainer_id, py.client_id, py.package_id, py.description, pk.credits, least(4, pk.credits - 1), py.id from public.coach_payments py join public.coach_packages pk on pk.id = py.package_id;
select t.ok((select refund_terms ->> 'mode' from public.coach_client_packages where name = '10 sessions') = 'prorated', 'the policy at purchase is copied onto the package');
update public.coach_refund_policies set mode = 'none';
select t.ok((public.coach_refund_quote((select id from public.coach_payments where description = '10 sessions')) ->> 'refundable')::boolean, 'changing the policy later doesn''t apply backwards');
select t.ok((public.coach_refund_quote((select id from public.coach_payments where description = '10 sessions')) ->> 'suggested_cents')::int = 60000 * 6 / 10 - 500, 'prorated: 6 of 10 unused, minus the fee');
select t.ok(not (public.coach_refund_quote((select id from public.coach_payments where description = 'Intro special')) ->> 'refundable')::boolean, 'a non-refundable package says so');
select t.ok((public.coach_refund_quote((select id from public.coach_payments where description = 'Intro special')) ->> 'reason') = 'This purchase is non-refundable.', 'with a plain reason');

select t.as_admin();
update public.coach_payments set paid_at = now() - interval '45 days' where description = '10 sessions';
select t.as_user('trainer');
select t.ok((public.coach_refund_quote((select id from public.coach_payments where description = '10 sessions')) ->> 'reason') like 'Refunds are only available within 30 days%', 'outside the window: not refundable, and why');
update public.coach_payments set refunded_cents = 10000, status = 'refunded' where description = '10 sessions';
select t.ok((select refund_outside_policy from public.coach_payments where description = '10 sessions'), 'a refund outside the policy is flagged');
select t.ok(t.refused($$update public.coach_payments set refunded_cents = 99999 where description = 'Intro special'$$), 'can''t refund more than was paid');
select t.ok((select status from public.coach_client_packages where name = '10 sessions') = 'cancelled', 'the refunded package closes (sessions follow refunds)');

select t.as_user('ana'); select public.coach_link_me();
select t.ok((public.coach_refund_quote((select id from public.coach_payments where description = 'Intro special')) ->> 'refundable') = 'false', 'the client can see the quote for their own payment');
select t.ok((select count(*) from public.coach_refund_policies) = 1, 'and read the policy');
select t.as_user('trainer2');
select t.ok(t.refused($$select public.coach_refund_quote((select id from public.coach_payments limit 1))$$) or (select count(*) from public.coach_payments) = 0, 'other trainers get nothing');
select t.ok(t.refused($$insert into public.coach_refund_policies (trainer_id) select v from t.ids where k = 'trainer'$$), 'nobody writes someone else''s policy');
\echo ALL REFUND POLICY TESTS PASSED
