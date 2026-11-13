-- Workouts in progress submit themselves after 4 hours without interaction (owner 2026-11-12), with exactly what was
-- checked off, and the trainer is told.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('ana', gen_random_uuid()), ('bo', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Emmet' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'ana@example.com' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Bo', 'bo@example.com' from t.ids where k = 'trainer';
insert into public.coach_assignments (trainer_id, client_id, scheduled_on, title, snapshot)
  select c.trainer_id, c.id, current_date, x.t, '[]' from public.coach_clients c, (values ('Legs'), ('Arms'), ('Empty')) x(t) where c.first_name = 'Ana';
insert into public.coach_assignments (trainer_id, client_id, scheduled_on, title) select trainer_id, id, current_date, 'Bo day' from public.coach_clients where first_name = 'Bo';
select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
select t.as_user('ana'); select public.coach_link_me();
select t.as_user('bo'); select public.coach_link_me();
select t.as_admin();
create temp table asg as select a.id, a.title, a.client_id from public.coach_assignments a;
grant select on asg to authenticated;
-- Ana did 2 of 3 sets of squats and none of the lunges
create temp table logj as select '[{"block_id":"b1","sets":[{"reps":10,"done":true},{"reps":10,"done":true},{"reps":10,"done":false}]},{"block_id":"b2","sets":[{"reps":8,"done":false}]}]'::jsonb j;
grant select on logj to authenticated;

select t.as_user('ana');
insert into public.coach_workout_live (assignment_id, client_id, started_at, entries)
  select id, client_id, now() - interval '30 minutes', (select j from logj) from asg where title = 'Legs';
insert into public.coach_workout_live (assignment_id, client_id, started_at, entries)
  select id, client_id, now(), '[{"block_id":"b1","sets":[{"done":false}]}]' from asg where title = 'Empty';
select t.ok((select source = 'app' and user_id = auth.uid() and touched_at > now() - interval '1 minute' from public.coach_workout_live where assignment_id = (select id from asg where title = 'Legs')), 'a client keeps a live copy of their workout');
select t.ok(t.refused($$insert into public.coach_workout_live (assignment_id, client_id, started_at) select id, client_id, now() from asg where title = 'Bo day'$$), 'but not of someone else''s');
select t.ok(t.refused($$insert into public.coach_workout_live (assignment_id, client_id, started_at) select a.id, b.client_id, now() from asg a, asg b where a.title = 'Arms' and b.title = 'Bo day'$$), 'or under another client');
select t.as_user('bo');
select t.ok((select count(*) from public.coach_workout_live) = 0, 'other people can''t see it');
select t.as_user('trainer2');
select t.ok(t.refused($$insert into public.coach_workout_live (assignment_id, client_id, started_at) select id, client_id, now() from asg where title = 'Arms'$$), 'other trainers can''t write one');

-- Within 4 hours nothing happens
select t.as_admin();
select t.ok(public.coach_submit_idle_workouts() = 0, 'a workout touched recently isn''t submitted');
-- 4 hours with no interaction (the server's time, not the phone's)
update public.coach_workout_live set touched_at = now() - interval '4 hours', started_at = now() - interval '4 hours 30 minutes';
select t.ok(public.coach_submit_idle_workouts() = 1, 'after 4 hours without activity it submits itself');
select t.ok((select status from public.coach_assignments where title = 'Legs') = 'done', 'the workout counts as completed');
select t.ok((select auto_submitted and note ~ '4 hours' and jsonb_array_length(entries) = 1 and jsonb_array_length(entries->0->'sets') = 2
  from public.coach_logs where assignment_id = (select id from asg where title = 'Legs')), 'only the 2 sets checked off are in it; the rest show as not done');
select t.ok((select duration_seconds between 1790 and 1810 from public.coach_logs where assignment_id = (select id from asg where title = 'Legs')) is not null, 'its length stops at the last activity');
select t.ok((select status from public.coach_assignments where title = 'Empty') = 'scheduled', 'a workout with nothing checked off isn''t submitted as completed');
select t.ok((select count(*) from public.coach_workout_live) = 0, 'the live copies are cleared');
select t.ok(public.coach_submit_idle_workouts() = 0, 'and nothing is submitted twice');

-- Submitted already (from the app): the live copy can't come back
select t.as_user('ana');
select t.ok(t.refused($$insert into public.coach_workout_live (assignment_id, client_id, started_at) select id, client_id, now() from asg where title = 'Legs'$$), 'a submitted workout can''t be reopened as live');
-- A manual submit wins over a live copy waiting to time out
insert into public.coach_workout_live (assignment_id, client_id, started_at, entries) select id, client_id, now(), (select j from logj) from asg where title = 'Arms';
insert into public.coach_logs (assignment_id, client_id, user_id, entries) select id, client_id, auth.uid(), '[]' from asg where title = 'Arms';
select t.as_admin();
update public.coach_workout_live set touched_at = now() - interval '5 hours';
select t.ok(public.coach_submit_idle_workouts() = 0 and (select count(*) from public.coach_logs where assignment_id = (select id from asg where title = 'Arms')) = 1, 'a workout submitted by hand isn''t submitted again');

-- The trainer is told when a client submits
select t.ok((select count(*) from public.coach_logs where auto_submitted) = 1, 'the trainer sees it was submitted automatically');
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_logs where auto_submitted) = 1, 'and can read the result');
select t.ok(t.refused($$select public.coach_submit_idle_workouts()$$), 'only the server runs the submit');
select t.ok(public.coach_done_only('[{"sets":[{"done":true},{"done":false}]},{"sets":[{}]}]') = '[{"sets":[{"done":true}]}]'::jsonb, 'unchecked sets never count');
select 'ALL LIVE-WORKOUT TESTS PASSED';
