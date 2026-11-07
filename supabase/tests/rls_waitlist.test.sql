-- Slot waitlist: clients add their own entries; trainers see their clients'; a cancellation is recorded as an open
-- time; booking a waitlisted client checks the time is still free; other trainers see nothing.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('ana', gen_random_uuid()), ('bo', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name, timezone) select v, 'Emmet', 'America/New_York' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'ana@example.com' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Bo', 'bo@example.com' from t.ids where k = 'trainer';
select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
select t.as_admin();
insert into t.ids select 'c_ana', id from public.coach_clients where first_name = 'Ana';
insert into t.ids select 'c_bo', id from public.coach_clients where first_name = 'Bo';
-- A slot 10 days out at 07:00 New York time
insert into t.ids select 'slot', gen_random_uuid();
create table t.slot as select ((current_date + 10) + time '07:00') at time zone 'America/New_York' as s;
grant select on t.slot to authenticated, anon;
select t.as_user('ana'); select public.coach_link_me();
select t.as_user('bo'); select public.coach_link_me();

select t.as_user('ana');
insert into public.coach_slot_waitlist (client_id, weekday, start_time, mode)
  select v, extract(dow from ((select s from t.slot) at time zone 'America/New_York'))::int, '07:00', 'auto_book' from t.ids where k = 'c_ana';
select t.ok(t.refused($$insert into public.coach_slot_waitlist (client_id, starts_at) select v, (select s from t.slot) from t.ids where k = 'c_bo'$$), 'a client can''t add someone else');
select t.ok(t.refused($$insert into public.coach_slot_waitlist (client_id, starts_at, weekday, start_time) select v, (select s from t.slot), 1, '07:00' from t.ids where k = 'c_ana'$$), 'one date or every week, not both');
select t.as_user('bo');
insert into public.coach_slot_waitlist (client_id, starts_at) select v, (select s from t.slot) from t.ids where k = 'c_bo';
select t.ok((select count(*) from public.coach_slot_waitlist) = 1, 'clients see only their own entries');

select t.as_user('trainer');
select t.ok((select count(*) from public.coach_slot_waitlist) = 2, 'the trainer sees their clients'' entries');
select t.ok((select array_agg(client_id order by created_at) from public.coach_waitlist_for((select v from t.ids where k = 'trainer'), (select s from t.slot), 60))
  = array[(select v from t.ids where k = 'c_ana'), (select v from t.ids where k = 'c_bo')], 'both wait for that time, first come first served (weekly and one-date entries match)');

-- Bo has the slot; cancelling it records an open time
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, duration_min, repeat)
  select (select v from t.ids where k = 'trainer'), v, 'Session', (select s from t.slot) - interval '7 days', 60, 'weekly' from t.ids where k = 'c_bo';
select t.ok(t.refused($$select public.coach_waitlist_book((select id from public.coach_slot_waitlist where mode = 'auto_book'), (select s from t.slot))$$), 'can''t book a waitlisted client into a time that''s taken');
update public.coach_bookings set skipped = array[((select s from t.slot) at time zone 'America/New_York')::date];
select t.ok((select count(*) from public.coach_open_slots where starts_at = (select s from t.slot)) = 1, 'the cancellation is recorded as an open time');
select public.coach_waitlist_book((select id from public.coach_slot_waitlist where mode = 'auto_book'), (select s from t.slot));
select t.ok((select count(*) from public.coach_bookings where client_id = (select v from t.ids where k = 'c_ana') and starts_at = (select s from t.slot)) = 1, 'the first waitlisted client is booked in');
select t.ok((select active and filled_booking_id is not null from public.coach_slot_waitlist where mode = 'auto_book'), 'a weekly entry stays on the list for next time');

select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_slot_waitlist) = 0 and (select count(*) from public.coach_open_slots) = 0, 'other trainers see nothing');
select t.ok(t.refused($$select public.coach_waitlist_book((select id from public.coach_slot_waitlist limit 1), now() + interval '20 days')$$), 'and can''t book anyone from it');
set role anon;
select t.ok(t.refused($$select count(*) from public.coach_slot_waitlist$$), 'signed-out visitors are refused');
\echo ALL WAITLIST TESTS PASSED
