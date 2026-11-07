-- Client pool and slot offers: trainers manage their own; clients edit their own availability and opt-in;
-- an offer link shows only that slot, the first acceptance books it, and later ones are too late.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('ana', gen_random_uuid()), ('bo', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;

select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Emmet Trainer' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email, frequency_tier) select v, 'Ana', 'ana@example.com', 'occasional' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email, frequency_tier) select v, 'Bo', 'bo@example.com', 'on_call' from t.ids where k = 'trainer';
select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Cy', 'cy@example.com' from t.ids where k = 'trainer2';
select t.as_admin();
insert into t.ids select 'c_ana', id from public.coach_clients where first_name = 'Ana';
insert into t.ids select 'c_bo', id from public.coach_clients where first_name = 'Bo';
insert into t.ids select 'c_cy', id from public.coach_clients where first_name = 'Cy';
select t.as_user('ana'); select public.coach_link_me();
select t.as_user('bo'); select public.coach_link_me();

-- Opt-in belongs to the client
select t.as_user('trainer');
select t.ok(t.refused($$update public.coach_clients set short_notice_ok = true where first_name = 'Ana'$$), 'a trainer can''t opt a client in to short-notice offers');
select t.as_user('ana');
select public.coach_set_short_notice(true);
insert into public.coach_client_availability (client_id, weekday, start_time, end_time) select v, 2, '06:00', '09:00' from t.ids where k = 'c_ana';
select t.ok((select count(*) from public.coach_client_availability) = 1, 'a client sets when they''re free');
select t.ok(t.refused($$insert into public.coach_client_availability (client_id, weekday, start_time, end_time) select v, 2, '06:00', '09:00' from t.ids where k = 'c_bo'$$), 'not for another client');
select t.as_user('trainer');
select t.ok((select short_notice_ok and short_notice_at is not null from public.coach_clients where first_name = 'Ana'), 'the trainer sees the opt-in and when it was given');
update public.coach_clients set short_notice_ok = false where first_name = 'Ana';
select t.ok((select not short_notice_ok from public.coach_clients where first_name = 'Ana'), 'the trainer can switch it off');
select t.ok((select count(*) from public.coach_client_availability) = 1, 'the trainer sees their client''s availability');
select t.ok((select count(*) from public.coach_client_last_seen()) = 2, 'last-seen covers only the trainer''s own clients');

-- Offers
insert into public.coach_slot_offers (starts_at, expires_at, title) values (now() + interval '1 day', now() + interval '23 hours', 'Open slot');
insert into public.coach_slot_offer_recipients (offer_id, client_id) select o.id, i.v from public.coach_slot_offers o, t.ids i where i.k in ('c_ana', 'c_bo');
select t.ok(t.refused($$insert into public.coach_slot_offer_recipients (offer_id, client_id) select o.id, i.v from public.coach_slot_offers o, t.ids i where i.k = 'c_cy'$$), 'only your own clients can get your offer');
select t.as_admin();
insert into t.ids select 'tok_ana', token from public.coach_slot_offer_recipients r where client_id = (select v from t.ids where k = 'c_ana');
insert into t.ids select 'tok_bo', token from public.coach_slot_offer_recipients r where client_id = (select v from t.ids where k = 'c_bo');
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_slot_offers) = 0 and (select count(*) from public.coach_slot_offer_recipients) = 0, 'other trainers see no offers');
select t.as_user('ana');
select t.ok((select count(*) from public.coach_slot_offer_recipients) = 0, 'clients don''t browse offer tables directly');

-- Link answers (signed out)
set role anon;
select t.ok((select state from public.coach_slot_offer_view((select v from t.ids where k = 'tok_ana'))) = 'open', 'the link shows the open slot');
select t.ok((select trainer_name from public.coach_slot_offer_view((select v from t.ids where k = 'tok_ana'))) = 'Emmet Trainer', 'with the trainer''s name');
select t.ok(public.coach_answer_slot_offer((select v from t.ids where k = 'tok_ana'), true) = 'yours', 'first to accept gets it');
select t.ok(public.coach_answer_slot_offer((select v from t.ids where k = 'tok_bo'), true) = 'filled', 'second acceptance is too late');
select t.ok(public.coach_answer_slot_offer((select v from t.ids where k = 'tok_ana'), true) = 'yours', 'accepting twice is harmless');
select t.ok(t.refused($$select public.coach_answer_slot_offer(gen_random_uuid(), true)$$), 'a made-up link is refused');
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_bookings where client_id = (select v from t.ids where k = 'c_ana')) = 1, 'exactly one booking was made, for the first to accept');
select t.ok((select status = 'filled' from public.coach_slot_offers), 'the offer shows filled');
select t.ok((select response from public.coach_slot_offer_recipients where client_id = (select v from t.ids where k = 'c_bo')) = 'too_late', 'the other recipient is marked too late');
select t.ok(t.refused($$insert into public.coach_slot_offers (starts_at, expires_at) values (now(), now() + interval '1 hour')$$), 'an offer can''t expire after the slot starts');
\echo ALL CLIENT POOL TESTS PASSED
