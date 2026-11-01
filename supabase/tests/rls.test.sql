-- Row-level security tests for the coach_ tables. Run with:  supabase/tests/run.sh
-- Each check switches to the "authenticated" role as a given user, the way Supabase does.
\set ON_ERROR_STOP on
set client_min_messages = warning;

create schema t;
create table t.ids (k text primary key, v uuid);
create function t.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce((select v::text from t.ids where k = u), ''), false);
  execute 'set role authenticated';
end $$;
create function t.as_admin() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', false); end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', what; end if;
  raise notice 'ok - %', what;
end $$;
-- true when the statement is refused (RLS, a guard, or a privilege error)
create function t.refused(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false;
exception when insufficient_privilege or check_violation or raise_exception or no_data_found or unique_violation then return true;
end $$;
grant usage on schema t to authenticated, anon;
grant select on t.ids to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- People: two trainers, two clients, one outsider
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()),
  ('client', gen_random_uuid()), ('client2', gen_random_uuid()), ('outsider', gen_random_uuid()), ('unconfirmed', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', case when k = 'unconfirmed' then null else now() end from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;

-- ---------------------------------------------------------------- setup through the app's own paths
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Coach' from t.ids where k = 'trainer';
-- Added by email; the trainer tries to mark them active and attach an account directly: both are ignored
insert into public.coach_clients (trainer_id, name, email, status, user_id)
  select t1.v, 'Client One', 'CLIENT@example.com', 'active', t2.v from t.ids t1, t.ids t2 where t1.k = 'trainer' and t2.k = 'outsider';
select t.ok((select user_id is null and status = 'invited' from public.coach_clients), 'a trainer cannot attach an account or mark a new client active');
select t.ok(t.refused($$insert into public.coach_clients (trainer_id, name, email) select auth.uid(), 'No Email', 'not-an-email'$$), 'a client needs a real email address');
insert into public.coach_clients (trainer_id, name, email) select v, 'Never Confirmed', 'unconfirmed@example.com' from t.ids where k = 'trainer';
insert into public.coach_exercises (trainer_id, name) select v, 'TRX Row' from t.ids where k = 'trainer';
insert into public.coach_workouts (trainer_id, name, blocks)
  select v, 'Day A', '[{"id":"b1","kind":"strength","exercise_id":null,"sets":3,"reps":"10"}]' from t.ids where k = 'trainer';
insert into public.coach_programs (trainer_id, name, weeks, schedule)
  select t.ids.v, 'Starter', 2, jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'workout_id', w.id), jsonb_build_object('week', 2, 'day', 3, 'workout_id', w.id))
  from t.ids, public.coach_workouts w where t.ids.k = 'trainer';
select t.ok(t.refused($$insert into public.coach_clients (trainer_id, name, email) select auth.uid(), 'Dup', 'client@EXAMPLE.com'$$),
  'the same email cannot be added twice by one trainer');
select t.ok(public.coach_assign_program((select id from public.coach_programs), (select id from public.coach_clients where name = 'Client One'), date '2026-11-02') = 2,
  'trainer assigns a 2-workout program');
select t.ok((select scheduled_on from public.coach_assignments order by scheduled_on desc limit 1) = date '2026-11-11', 'program dates land on week 2, day 3');
insert into public.coach_client_notes (client_id, trainer_id, notes)
  select c.id, c.trainer_id, 'private: knee history' from public.coach_clients c where c.name = 'Client One';

select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other Coach' from t.ids where k = 'trainer2';
insert into public.coach_clients (trainer_id, name, email) select v, 'Their Client', 'someone@example.com' from t.ids where k = 'trainer2';

-- ---------------------------------------------------------------- first sign-in links by email
select t.as_user('client2');
select t.ok(public.coach_link_me() = 0, 'someone with a different email links to nothing');
select t.as_user('unconfirmed');
select t.ok(public.coach_link_me() = 0, 'an unconfirmed email cannot claim a client record');
select t.as_user('client');
select t.ok((select count(*) from public.coach_assignments) = 0, 'client sees nothing before their first sign-in links them');
select t.ok(public.coach_link_me() = 1, 'first sign-in links the client record by email (any letter case)');
select t.ok(public.coach_link_me() = 0, 'linking again does nothing');
set role postgres;
select t.ok((select status = 'active' and started_on = current_date from public.coach_clients where name = 'Client One'), 'linked client becomes active');
select t.as_user('client');

-- ---------------------------------------------------------------- the linked client
select t.as_user('client');
select t.ok((select count(*) from public.coach_clients) = 1, 'client sees only their own client row');
select t.ok((select count(*) from public.coach_assignments) = 2, 'client sees their 2 assignments');
select t.ok((select count(*) from public.coach_exercises) = 1, 'client can read their trainer''s exercises');
select t.ok((select count(*) from public.coach_workouts) = 0, 'client cannot browse the trainer''s workout templates');
select t.ok((select count(*) from public.coach_client_notes) = 0, 'client cannot read the trainer''s private notes');
select t.ok((select count(*) from public.coach_trainers) = 1, 'client can read only their own trainer''s profile');
select t.ok((select count(*) from public.coach_people() where relation = 'trainer') = 1, 'client sees their trainer''s username');
select t.ok(t.refused($$update public.coach_assignments set status = 'done'$$) or
  (select count(*) from public.coach_assignments where status = 'done') = 0, 'client cannot edit assignments directly');
select t.ok(t.refused($$update public.coach_clients set status = 'archived' returning 1$$) or
  (select status from public.coach_clients) = 'active', 'client cannot change their client record');
insert into public.coach_logs (assignment_id, client_id, user_id, entries, rpe)
  select a.id, a.client_id, auth.uid(), '[{"block_id":"b1","sets":[{"reps":10,"load":20,"unit":"kg","done":true}]}]', 7
  from public.coach_assignments a order by scheduled_on limit 1;
select t.ok((select count(*) from public.coach_assignments where status = 'done') = 1, 'logging a workout marks the assignment done');
select t.ok(t.refused($$insert into public.coach_logs (client_id, user_id, source)
  select id, auth.uid(), 'trainer' from public.coach_clients$$), 'client cannot write a log as the trainer');
select t.ok(t.refused($$insert into public.coach_logs (client_id, user_id)
  select c.id, auth.uid() from public.coach_clients c$$) = false, 'client can log a free workout');
select t.ok(t.refused($$insert into public.coach_trainers (user_id, display_name)
  select v, 'Hijack' from t.ids where k = 'trainer2'$$), 'nobody can create a trainer profile for someone else');

-- ---------------------------------------------------------------- the trainer
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_clients) = 2, 'trainer sees only their own clients');
select t.ok(t.refused($$update public.coach_clients set email = 'other@example.com' where name = 'Client One'$$), 'a linked client''s email cannot be swapped');
select t.ok(t.refused($$select * from public.coach_account_for_email('client@example.com')$$), 'only the server can look up accounts by email');
select t.ok((select count(*) from public.coach_logs) = 2, 'trainer sees their client''s logs');
select t.ok((select count(*) from public.coach_people() where relation = 'client') = 1, 'trainer sees their client''s username');
select t.ok(t.refused($$insert into public.coach_assignments (trainer_id, client_id, scheduled_on, title)
  select auth.uid(), c.id, current_date, 'x' from public.coach_clients c, t.ids where false$$) = false, 'sanity: empty insert passes');

-- ---------------------------------------------------------------- the other trainer
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_clients) = 1, 'other trainer sees only their own client');
select t.ok((select count(*) from public.coach_logs) = 0, 'other trainer cannot read another trainer''s client logs');
select t.ok((select count(*) from public.coach_client_notes) = 0, 'other trainer cannot read another trainer''s notes');
select t.as_admin();
create temp table victim2 as select id from public.coach_clients where name = 'Client One';
grant select on victim2 to authenticated;
select t.as_user('trainer2');
select t.ok(t.refused($$insert into public.coach_assignments (trainer_id, client_id, scheduled_on, title)
  select auth.uid(), id, current_date, 'sneaky' from victim2$$), 'other trainer cannot assign work to someone else''s client');
select t.ok(t.refused($$update public.coach_clients set trainer_id = auth.uid() where id = (select id from victim2) returning 1$$)
  or (select count(*) from public.coach_clients where name = 'Client One') = 0, 'other trainer cannot take over someone else''s client');
select t.ok(t.refused($$insert into public.coach_client_notes (client_id, trainer_id, notes)
  select id, auth.uid(), 'x' from victim2$$), 'other trainer cannot attach notes to someone else''s client');

-- ---------------------------------------------------------------- outsiders
select t.as_user('outsider');
select t.ok((select count(*) from public.coach_clients) + (select count(*) from public.coach_assignments)
  + (select count(*) from public.coach_logs) + (select count(*) from public.coach_exercises) = 0, 'a signed-in stranger sees nothing');
select t.as_admin();
set role anon;
select t.ok(t.refused($$select 1 from public.coach_clients$$), 'anonymous visitors are refused');
select t.as_admin();

-- ---------------------------------------------------------------- removing a client
select t.as_user('trainer');
update public.coach_clients set status = 'archived';
select t.as_user('client');
select t.ok((select count(*) from public.coach_assignments) = 0, 'an archived client loses access to assignments');
select t.ok((select count(*) from public.coach_exercises) = 0, 'an archived client loses access to the library');
select t.as_admin();
\echo 'ALL RLS TESTS PASSED'
