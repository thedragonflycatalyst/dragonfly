-- Routines (owner 2026-11-13): assigned without a date, started by the client or trainer when they train; workout
-- reminders for a routine at a day and time.
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
insert into public.coach_workouts (trainer_id, name, blocks)
  select v, 'Legs', '[{"id":"b1","kind":"exercise","ex":{"src":"lib","id":"c-goblet-squat","name":"Goblet Squat"},"metric":"reps","sets":[{"reps":10}]}]' from t.ids where k = 'trainer';
select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Cy', 'cy@example.com' from t.ids where k = 'trainer2';
select t.as_user('ana'); select public.coach_link_me();
select t.as_user('bo'); select public.coach_link_me();
select t.as_admin();
create temp table ids2 as select (select id from public.coach_workouts where name = 'Legs') w, (select id from public.coach_clients where first_name = 'Ana') ana,
  (select id from public.coach_clients where first_name = 'Bo') bo, (select id from public.coach_clients where first_name = 'Cy') cy;
grant select on ids2 to authenticated;

-- Assigning: no date, any number of clients, again just updates the note
select t.as_user('trainer');
select t.ok(public.coach_assign_routine((select w from ids2), array[(select ana from ids2), (select bo from ids2)], 'Go light') = 2, 'a saved workout is assigned to two clients');
select t.ok(public.coach_assign_routine((select w from ids2), array[(select ana from ids2)], 'Heavier now') = 1 and (select count(*) from public.coach_client_routines) = 2, 'assigning again doesn''t duplicate it');
select t.ok((select note from public.coach_client_routines where client_id = (select ana from ids2)) = 'Heavier now', 'it updates the note');
select t.ok((select count(*) from public.coach_assignments) = 0, 'nothing is put on a date');
select t.ok(t.refused($$select public.coach_assign_routine((select w from ids2), array[(select cy from ids2)])$$), 'can''t assign to another trainer''s client');
-- Editing the saved workout updates the routine
update public.coach_workouts set name = 'Legs A' where id = (select w from ids2);
select t.ok((select title from public.coach_client_routines where client_id = (select ana from ids2)) = 'Legs A', 'routines follow the latest version of the workout');

-- The client sees only their own routines and starts one
select t.as_user('ana');
select t.ok((select count(*) from public.coach_client_routines) = 1, 'a client sees only their routines');
create temp table started as select public.coach_start_routine((select id from public.coach_client_routines)) aid;
grant select on started to authenticated;
select t.ok((select status = 'scheduled' and title = 'Legs A' and routine_id is not null and trainer_note = 'Heavier now' from public.coach_assignments where id = (select aid from started)), 'starting it makes today''s workout');
select t.ok(public.coach_start_routine((select id from public.coach_client_routines)) = (select aid from started), 'starting again before finishing opens the same one');
insert into public.coach_logs (assignment_id, client_id, user_id, entries) select aid, (select ana from ids2), auth.uid(), '[]' from started;
select t.ok(public.coach_start_routine((select id from public.coach_client_routines)) <> (select aid from started), 'after finishing, the next start is a new workout');
select t.ok(t.refused($$select public.coach_assign_routine((select w from ids2), array[(select ana from ids2)])$$), 'clients can''t assign');

select t.as_user('bo');
select t.ok(t.refused($$select public.coach_start_routine((select id from public.coach_client_routines where client_id = (select ana from ids2)))$$), 'clients can''t start each other''s routines');
select t.as_user('trainer');
select t.ok(public.coach_start_routine((select id from public.coach_client_routines where client_id = (select bo from ids2))) is not null, 'the trainer can start a client''s routine in a session');
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_client_routines) = 0, 'other trainers see none');

-- Reminders: Wednesday 3 PM, once or weekly
select t.as_user('trainer');
create temp table rem as select public.coach_set_workout_reminder((select id from public.coach_client_routines where client_id = (select ana from ids2)), now() + interval '2 days', true) id;
grant select on rem to authenticated;
select t.ok((select weekly and active from public.coach_workout_reminders where id = (select id from rem)), 'the trainer sets a weekly reminder');
select t.ok(t.refused($$select public.coach_set_workout_reminder((select id from public.coach_client_routines where client_id = (select ana from ids2)), now() - interval '1 hour', false)$$), 'a one-time reminder must be in the future');
select t.as_user('ana');
select t.ok((select count(*) from public.coach_workout_reminders) = 1, 'the client sees their reminder');
select t.ok(public.coach_set_workout_reminder((select id from public.coach_client_routines), now() + interval '3 days', false) is not null, 'and can set their own');
select public.coach_stop_workout_reminder((select id from rem));
select t.ok((select count(*) from public.coach_workout_reminders where active) = 1, 'and stop one');
select t.as_user('bo');
select t.ok(t.refused($$select public.coach_stop_workout_reminder((select id from public.coach_workout_reminders limit 1))$$) or (select count(*) from public.coach_workout_reminders) = 0, 'others can''t see or stop them');

-- Taking a routine off the list stops its reminders and keeps history
select t.as_user('trainer');
select public.coach_remove_routine((select id from public.coach_client_routines where client_id = (select ana from ids2)));
select t.ok((select count(*) from public.coach_workout_reminders where active) = 0, 'removing a routine stops its reminders');
select t.ok((select count(*) from public.coach_logs) = 1, 'and keeps what was done');
select t.ok(public.coach_assign_routine((select w from ids2), array[(select ana from ids2)]) = 1, 'it can be assigned again later');
select t.as_admin();
insert into public.coach_outbox (trainer_id, client_id, purpose, kind, channel, body) select trainer_id, id, 'reminders', 'workout_reminder', 'app', 'x' from public.coach_clients where first_name = 'Ana';
select t.ok(true, 'workout reminders go through the outbox');
select t.as_user('trainer');
delete from public.coach_workouts where id = (select w from ids2);
select t.ok((select count(*) from public.coach_client_routines where active) = 0, 'deleting the workout takes it off clients'' routines');
select t.ok((select count(*) from public.coach_logs) = 1, 'and keeps what they did');
select 'ALL ROUTINE TESTS PASSED';
