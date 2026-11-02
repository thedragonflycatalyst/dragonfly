-- Row-level security tests for teams. Run with: supabase/tests/run.sh
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('owner', gen_random_uuid()), ('coach', gen_random_uuid()), ('solo', gen_random_uuid()), ('client', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
create function t.view_as(who text, edit boolean default false) returns void language plpgsql as $$
begin perform set_config('request.headers', json_build_object('x-dragonfly-trainer', (select v from t.ids where k = who), 'x-dragonfly-edit', case when edit then '1' else '' end)::text, false); end $$;
create function t.view_self() returns void language plpgsql as $$ begin perform set_config('request.headers', '{}', false); end $$;
grant execute on all functions in schema t to authenticated;
set client_min_messages = notice;

-- the owner and a solo trainer, each with a client and a workout
select t.as_user('owner');
insert into public.coach_trainers (user_id, display_name) select v, 'Dragonfly' from t.ids where k = 'owner';
insert into public.coach_workouts (trainer_id, name) select v, 'Owner workout' from t.ids where k = 'owner';
select t.as_user('solo');
insert into public.coach_trainers (user_id, display_name) select v, 'Solo' from t.ids where k = 'solo';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Sam', 'sam@example.com' from t.ids where k = 'solo';

select t.as_user('owner');
select t.ok(public.coach_team_create('The Dragonfly Catalyst') is not null, 'owner creates a team');
select t.ok(t.refused($$select public.coach_team_create('Again')$$), 'one team per owner');
select t.ok(public.coach_team_add('coach@example.com', 'Alex') is not null, 'owner adds a trainer by email');
select t.ok((select count(*) from public.coach_team_members) = 2, 'owner sees the team list');

-- the trainer signs in and joins
select t.as_user('coach');
select t.ok(public.coach_join_team() = 1, 'invited trainer joins on sign-in and becomes a trainer');
select t.ok((select display_name from public.coach_trainers where user_id = auth.uid()) = 'Alex', 'their trainer profile is created');
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'client@example.com' from t.ids where k = 'coach';
insert into public.coach_workouts (trainer_id, name) select v, 'Coach workout' from t.ids where k = 'coach';
insert into public.coach_foods (trainer_id, name, kcal) select v, 'Team shake', 120 from t.ids where k = 'coach';
select t.ok((select count(*) from public.coach_workouts) = 1, 'a team trainer sees only their own workouts');
select t.ok((select count(*) from public.coach_team_members) = 2, 'a team trainer sees the team list');
select t.ok(t.refused($$select public.coach_team_add('x@example.com', 'X')$$), 'only the owner adds trainers');
select t.view_as('owner');
select t.ok((select count(*) from public.coach_workouts) = 1 and (select name from public.coach_workouts) = 'Coach workout', 'a trainer cannot view the owner''s account');
select t.view_self();
select t.as_user('client'); select public.coach_link_me();

-- the owner on their own account sees only their own data
select t.as_user('owner');
select t.ok((select count(*) from public.coach_workouts) = 1 and (select count(*) from public.coach_clients) = 0, 'owner''s own view shows only their own data');
select t.ok((select count(*) from public.coach_foods) = 1, 'the team shares one food library');

-- viewing the trainer's account
select t.view_as('coach');
select t.ok((select name from public.coach_workouts) = 'Coach workout' and (select count(*) from public.coach_workouts) = 1, 'viewing a trainer shows exactly their workouts');
select t.ok((select first_name from public.coach_clients) = 'Ana', 'viewing a trainer shows their clients');
select t.ok(t.refused($$insert into public.coach_workouts (trainer_id, name) select v, 'Sneaky' from t.ids where k = 'coach'$$), 'viewing is read-only by default');
select t.ok(t.refused($$update public.coach_workouts set name = 'Changed'$$) and (select name from public.coach_workouts) = 'Coach workout', 'no edits while only viewing');
select t.view_as('coach', true);
insert into public.coach_workouts (trainer_id, name) select v, 'Emergency fix' from t.ids where k = 'coach';
select t.ok((select count(*) from public.coach_workouts) = 2, 'emergency editing lets the owner make changes');
select t.ok(public.coach_owns_client((select id from public.coach_clients)), 'owner manages the trainer''s client while editing');
select t.view_as('solo', true);
select t.ok((select count(*) from public.coach_clients) = 0 and (select count(*) from public.coach_workouts) = 1, 'cannot view a trainer outside the team (falls back to own data)');
select t.view_self();

-- copies to a trainer
select t.ok(public.coach_copy_to_trainer('workout', (select id from public.coach_workouts where name = 'Owner workout'), (select v from t.ids where k = 'coach')) is not null, 'owner sends a workout copy to a trainer');
select t.ok(t.refused($$select public.coach_copy_to_trainer('workout', (select id from public.coach_workouts limit 1), (select v from t.ids where k = 'solo'))$$), 'cannot send copies outside the team');
select t.as_user('coach');
select t.ok((select count(*) from public.coach_workouts where name = 'Owner workout') = 1, 'the trainer receives the copy');
select t.ok(t.refused($$select public.coach_copy_to_trainer('workout', (select id from public.coach_workouts limit 1), (select v from t.ids where k = 'owner'))$$), 'trainers cannot push copies to the owner');

-- strangers and the solo trainer
select t.as_user('solo');
select t.view_as('coach', true);
select t.ok((select count(*) from public.coach_workouts) = 0 and (select count(*) from public.coach_clients) = 1, 'outsiders cannot view a team trainer, even with headers');
select t.ok((select count(*) from public.coach_foods) + (select count(*) from public.coach_team_members) = 0, 'outsiders see no team foods or members');
select t.view_self();

-- removal
select t.as_user('owner');
select public.coach_team_remove((select id from public.coach_team_members where role = 'trainer'));
select t.view_as('coach');
select t.ok((select count(*) from public.coach_clients) = 0, 'after removal the owner can no longer view that trainer');
select t.view_self();
select t.as_user('coach');
select t.ok((select count(*) from public.coach_clients) = 1, 'a removed trainer keeps their clients');
select t.as_admin();
\echo 'ALL TEAMS TESTS PASSED'
