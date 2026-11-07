-- Milestones: the client and their trainer record and read them; nobody else sees them; no edits or deletes.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('client', gen_random_uuid()), ('stranger', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;

select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Dragonfly' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'client@example.com' from t.ids where k = 'trainer';
select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Bo', 'bo@example.com' from t.ids where k = 'trainer2';
select t.as_admin(); insert into t.ids select 'ana', id from public.coach_clients where first_name = 'Ana';
select t.as_user('client'); select public.coach_link_me();

insert into public.coach_milestones (client_id, trainer_id, key) select id, (select v from t.ids where k = 'trainer2'), 'sessions:1' from public.coach_clients;
select t.ok((select trainer_id from public.coach_milestones) = (select v from t.ids where k = 'trainer'), 'the trainer comes from the client record, not the caller');
select t.ok(t.refused($$insert into public.coach_milestones (client_id, trainer_id, key) select id, trainer_id, 'sessions:1' from public.coach_clients$$), 'each milestone is recorded once');
select t.ok(t.refused($$insert into public.coach_milestones (client_id, trainer_id, key) select id, trainer_id, 'made up' from public.coach_clients$$), 'only known milestone kinds');
select t.ok(t.refused($$update public.coach_milestones set key = 'sessions:100'$$), 'milestones can''t be edited');
select t.ok(t.refused($$delete from public.coach_milestones$$), 'milestones can''t be deleted');

select t.as_user('trainer');
insert into public.coach_milestones (client_id, trainer_id, key) select id, trainer_id, 'streak:4' from public.coach_clients;
select t.ok((select count(*) from public.coach_milestones) = 2, 'the trainer sees and adds their client''s milestones');

select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_milestones) = 0, 'another trainer sees none');
select t.ok(t.refused($$insert into public.coach_milestones (client_id, trainer_id, key) select v, v, 'first_pr' from t.ids where k = 'ana'$$), 'another trainer can''t add one for someone else''s client');
select t.as_user('stranger');
select t.ok((select count(*) from public.coach_milestones) = 0, 'strangers see none');
set role anon;
select t.ok(t.refused($$select count(*) from public.coach_milestones$$), 'signed-out visitors are refused');
\echo ALL MILESTONE TESTS PASSED
