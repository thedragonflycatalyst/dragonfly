-- Row-level security tests for check-ins, client tasks and program tasks. Run with: supabase/tests/run.sh
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('client', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;

select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Dragonfly' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'client@example.com' from t.ids where k = 'trainer';
select t.as_user('client'); select public.coach_link_me();
select t.as_user('trainer');
insert into public.coach_checkin_plans (client_id, trainer_id, every_days, channel) select id, trainer_id, 7, 'call' from public.coach_clients;
insert into public.coach_checkins (client_id, trainer_id, channel, note, mood) select id, trainer_id, 'text', 'Knee feeling better', 4 from public.coach_clients;
select t.ok((select count(*) from public.coach_checkins) = 1 and (select every_days from public.coach_checkin_plans) = 7, 'trainer logs check-ins and sets a rhythm');
select t.ok(t.refused($$insert into public.coach_checkins (client_id, trainer_id, channel) select id, trainer_id, 'pigeon' from public.coach_clients$$), 'unknown channels are refused');

insert into public.coach_workouts (trainer_id, name) select v, 'Day A' from t.ids where k = 'trainer';
insert into public.coach_programs (trainer_id, name, weeks, schedule)
  select w.trainer_id, 'Block 1', 1, jsonb_build_array(
    jsonb_build_object('week', 1, 'day', 1, 'kind', 'workout', 'workout_id', w.id),
    jsonb_build_object('week', 1, 'day', 1, 'kind', 'measurements'),
    jsonb_build_object('week', 1, 'day', 3, 'kind', 'photo', 'title', 'Front and side photos'),
    jsonb_build_object('week', 1, 'day', 5, 'kind', 'bogus'))
  from public.coach_workouts w;
select t.ok((select am_time = '07:00' and pm_time = '19:00' from public.coach_programs), 'programs get default suggested times');
select t.ok(public.coach_assign_program((select id from public.coach_programs), (select id from public.coach_clients), current_date) = 3, 'assigning a program creates its workout and tasks');
select t.ok((select count(*) from public.coach_tasks) = 2 and (select title from public.coach_tasks where kind = 'photo') = 'Front and side photos', 'tasks keep their titles');

select t.as_user('client');
select t.ok((select count(*) from public.coach_checkins) + (select count(*) from public.coach_checkin_plans) = 0, 'clients don''t see the trainer''s check-in notes');
select t.ok((select count(*) from public.coach_tasks) = 2, 'clients see their tasks');
update public.coach_tasks set title = 'Mine';
select t.ok((select count(*) from public.coach_tasks where title = 'Mine') = 0, 'clients cannot edit tasks');
insert into public.coach_measurements (client_id, trainer_id, weight_kg) select id, trainer_id, 70 from public.coach_clients;
select t.ok((select done_at is not null from public.coach_tasks where kind = 'measurements'), 'adding measurements ticks off the measurements task');
select t.ok((select done_at is null from public.coach_tasks where kind = 'photo'), 'other tasks stay open');
select public.coach_task_done((select id from public.coach_tasks where kind = 'photo'), true);
select t.ok((select done_at is not null from public.coach_tasks where kind = 'photo'), 'client can tick off a task');

select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
select t.ok((select count(*) from public.coach_checkins) + (select count(*) from public.coach_tasks) + (select count(*) from public.coach_checkin_plans) = 0, 'another trainer sees nothing');
select t.as_admin();
create temp table task1 as select id from public.coach_tasks limit 1;
grant select on task1 to authenticated;
select t.as_user('trainer2');
select t.ok(t.refused($$select public.coach_task_done((select id from task1), true)$$), 'another trainer cannot tick tasks');
select t.as_admin();
\echo 'ALL CHECK-INS TESTS PASSED'
