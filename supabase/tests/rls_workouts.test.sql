-- Row-level security tests for the Workouts tab. Run with: supabase/tests/run.sh
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('client', gen_random_uuid()), ('outsider', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;

select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Dragonfly' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'client@example.com' from t.ids where k = 'trainer';
insert into public.coach_workout_folders (trainer_id, name) select v, 'Full body' from t.ids where k = 'trainer';
insert into public.coach_workouts (trainer_id, name, folder_id, blocks)
  select f.trainer_id, 'Full body A', f.id, '[{"id":"b1","kind":"exercise","ex":{"src":"lib","id":"Plank","name":"Plank"},"metric":"time","sets":[{"time":30}]}]' from public.coach_workout_folders f;
insert into public.coach_exercise_favorites (trainer_id, ref) select v, 'lib:Plank' from t.ids where k = 'trainer';
select t.ok(t.refused($$insert into public.coach_exercise_favorites (trainer_id, ref) select auth.uid(), 'drop table x'$$), 'favorites only accept exercise references');
select t.ok(public.coach_media_ok((select v || '/exercises/demo.mp4' from t.ids where k = 'trainer')), 'trainer can reach their own demo videos');

select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
select t.ok((select count(*) from public.coach_workout_folders) + (select count(*) from public.coach_workouts) + (select count(*) from public.coach_exercise_favorites) = 0,
  'another trainer sees none of the folders, workouts or favorites');
select t.as_admin();
create temp table f1 as select id from public.coach_workout_folders;
grant select on f1 to authenticated;
select t.as_user('trainer2');
select t.ok(t.refused($$insert into public.coach_workouts (trainer_id, name, folder_id) select auth.uid(), 'Sneaky', id from f1$$), 'a workout cannot go in another trainer''s folder');
select t.ok(public.coach_media_ok((select v || '/exercises/demo.mp4' from t.ids where k = 'trainer')) = false, 'another trainer cannot reach the demo videos');

-- assign, then the client works with it
select t.as_user('client');
select t.ok(public.coach_link_me() = 1, 'client links on sign-in');
select t.as_user('trainer');
insert into public.coach_assignments (trainer_id, client_id, workout_id, scheduled_on, title, snapshot)
  select w.trainer_id, c.id, w.id, current_date, w.name, w.blocks from public.coach_workouts w, public.coach_clients c;
select t.ok((select last_used_at is not null from public.coach_workouts), 'assigning marks the workout as recently used');

select t.as_user('client');
select t.ok((select count(*) from public.coach_workouts) = 0, 'client cannot browse the trainer''s workouts');
select t.ok((select count(*) from public.coach_assignments) = 1, 'client sees their assigned workout');
select t.ok(public.coach_media_ok((select v || '/exercises/demo.mp4' from t.ids where k = 'trainer')), 'client can watch their trainer''s demo videos');
select t.ok(public.coach_media_ok((select v || '/clients/secret.mp4' from t.ids where k = 'trainer')) = false, 'only the exercises folder is shared');
select public.coach_set_assignment_skipped((select id from public.coach_assignments), true);
select t.ok((select status from public.coach_assignments) = 'skipped', 'client can skip a workout');
select public.coach_set_assignment_skipped((select id from public.coach_assignments), false);
insert into public.coach_logs (assignment_id, client_id, user_id, entries, duration_seconds)
  select a.id, a.client_id, auth.uid(), '[{"block_id":"b1","sets":[{"time":30,"done":true}]}]', 900 from public.coach_assignments a;
select t.ok((select status from public.coach_assignments) = 'done', 'logging it marks it done');
select t.ok(t.refused($$select public.coach_set_assignment_skipped((select id from public.coach_assignments), true)$$), 'a finished workout cannot be skipped');

select t.as_user('outsider');
select t.ok(t.refused($$select public.coach_set_assignment_skipped((select id from public.coach_assignments where false), true)$$), 'a stranger cannot skip anything');
select t.ok(public.coach_media_ok((select v || '/exercises/demo.mp4' from t.ids where k = 'trainer')) = false, 'a stranger cannot reach the demo videos');

select t.as_user('trainer');
update public.coach_clients set status = 'frozen';
select t.as_user('client');
select t.ok(public.coach_media_ok((select v || '/exercises/demo.mp4' from t.ids where k = 'trainer')) = false, 'a frozen client loses access to demo videos');
select t.as_admin();
\echo 'ALL WORKOUTS-TAB TESTS PASSED'
