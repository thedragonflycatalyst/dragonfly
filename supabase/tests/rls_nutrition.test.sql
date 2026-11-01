-- Row-level security tests for the Nutrition tab. Run with: supabase/tests/run.sh
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('client', gen_random_uuid()), ('client2', gen_random_uuid()), ('outsider', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;

select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Dragonfly' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'client@example.com' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ben', 'client2@example.com' from t.ids where k = 'trainer';
insert into public.coach_nutrition_folders (trainer_id, name) select v, 'Cutting' from t.ids where k = 'trainer';
insert into public.coach_foods (trainer_id, name, serving_label, kcal, protein) select v, 'Protein bar', '1 bar', 240, 20 from t.ids where k = 'trainer';
insert into public.coach_nutrition_plans (trainer_id, name, folder_id, meals, targets)
  select f.trainer_id, 'Plan A', f.id, '[{"id":"m1","name":"Breakfast","items":[]}]', '{"on":true,"mode":"g","kcal":2000}' from public.coach_nutrition_folders f;
insert into public.coach_nutrition_plans (trainer_id, name) select v, 'Plan B (not shared)' from t.ids where k = 'trainer';
select t.ok(t.refused($$insert into public.coach_foods (trainer_id, name, kcal) select auth.uid(), 'Bad', -5$$), 'foods reject negative calories');
select t.ok(t.refused($$insert into public.coach_nutrition_plans (trainer_id, name, meals) select auth.uid(), 'Bad', '{}'$$), 'meals must be a list');

select t.as_user('client');  select t.ok(public.coach_link_me() = 1, 'client links on sign-in');
select t.as_user('client2'); select t.ok(public.coach_link_me() = 1, 'second client links');

select t.as_user('trainer');
insert into public.coach_nutrition_plan_clients (plan_id, client_id, trainer_id)
  select p.id, c.id, p.trainer_id from public.coach_nutrition_plans p, public.coach_clients c where p.name = 'Plan A' and c.first_name = 'Ana';
select t.ok((select last_used_at is not null from public.coach_nutrition_plans where name = 'Plan A'), 'sharing a plan marks it recently used');

select t.as_user('client');
select t.ok((select count(*) from public.coach_nutrition_plans) = 1 and (select name from public.coach_nutrition_plans) = 'Plan A', 'client sees only the plan shared with them');
select t.ok((select count(*) from public.coach_nutrition_plan_clients) = 1, 'client sees their own sharing row');
select t.ok((select count(*) from public.coach_foods) + (select count(*) from public.coach_nutrition_folders) = 0, 'client cannot browse custom foods or folders');
update public.coach_nutrition_plans set name = 'Mine now';
select t.ok((select name from public.coach_nutrition_plans) = 'Plan A', 'client cannot edit the plan');
select t.ok(t.refused($$insert into public.coach_nutrition_plan_clients (plan_id, client_id, trainer_id) select plan_id, client_id, trainer_id from public.coach_nutrition_plan_clients$$), 'client cannot share plans');

select t.as_user('client2');
select t.ok((select count(*) from public.coach_nutrition_plans) = 0, 'another client of the same trainer sees nothing');

select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Zed', 'zed@example.com' from t.ids where k = 'trainer2';
select t.ok((select count(*) from public.coach_nutrition_plans) + (select count(*) from public.coach_foods) + (select count(*) from public.coach_nutrition_folders) + (select count(*) from public.coach_nutrition_plan_clients) = 0,
  'another trainer sees nothing');
select t.as_admin();
create temp table ids as select (select id from public.coach_nutrition_plans where name = 'Plan A') plan, (select id from public.coach_nutrition_folders) folder,
  (select id from public.coach_clients where first_name = 'Ana') ana, (select id from public.coach_clients where first_name = 'Zed') zed;
grant select on ids to authenticated;
select t.as_user('trainer2');
select t.ok(t.refused($$insert into public.coach_nutrition_plan_clients (plan_id, client_id, trainer_id) select plan, zed, auth.uid() from ids$$), 'cannot share another trainer''s plan');
select t.ok(t.refused($$insert into public.coach_nutrition_plans (trainer_id, name, folder_id) select auth.uid(), 'Sneaky', folder from ids$$), 'cannot use another trainer''s folder');
select t.as_user('trainer');
select t.ok(t.refused($$insert into public.coach_nutrition_plan_clients (plan_id, client_id, trainer_id) select plan, zed, auth.uid() from ids$$), 'cannot share with another trainer''s client');

select t.as_user('outsider');
select t.ok((select count(*) from public.coach_nutrition_plans) = 0 and not public.coach_nutrition_plan_mine((select plan from ids)), 'a stranger sees nothing');

select t.as_user('trainer');
update public.coach_clients set status = 'frozen' where first_name = 'Ana';
select t.as_user('client');
select t.ok((select count(*) from public.coach_nutrition_plans) = 0, 'a frozen client loses access to plans');
select t.as_user('trainer');
delete from public.coach_nutrition_plans where name = 'Plan A';
select t.ok((select count(*) from public.coach_nutrition_plan_clients) = 0, 'deleting a plan removes its sharing');
select t.as_admin();
\echo 'ALL NUTRITION-TAB TESTS PASSED'
