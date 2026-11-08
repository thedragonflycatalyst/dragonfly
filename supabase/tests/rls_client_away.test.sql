-- Away notes: only the trainer sets them, dates must make sense, and auto-freeze leaves away clients alone.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('ana', gen_random_uuid()), ('bo', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name, timezone) select v, 'Trainer', 'America/New_York' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'ana@example.com' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Bo', 'bo@example.com' from t.ids where k = 'trainer';
select t.as_admin();
insert into t.ids select 'c_ana', id from public.coach_clients where first_name = 'Ana';
insert into t.ids select 'c_bo', id from public.coach_clients where first_name = 'Bo';
select t.as_user('ana'); select public.coach_link_me();
select t.as_user('bo'); select public.coach_link_me();

select t.as_user('trainer');
update public.coach_clients set away_reason = 'injury', away_from = current_date - 3, away_until = current_date + 20, away_note = 'Knee surgery'
 where id = (select v from t.ids where k = 'c_ana');
select t.ok((select away_note from public.coach_clients where id = (select v from t.ids where k = 'c_ana')) = 'Knee surgery', 'the trainer sets an away note');
select t.ok(t.refused($$update public.coach_clients set away_reason = 'travel', away_from = current_date, away_until = current_date - 1 where first_name = 'Bo'$$), 'back-before-start is refused');
select t.ok(t.refused($$update public.coach_clients set away_until = current_date + 5 where first_name = 'Bo'$$), 'dates need a reason');
select t.ok(t.refused($$update public.coach_clients set away_reason = 'vacation' where first_name = 'Bo'$$), 'only known reasons');

select t.as_user('ana');
update public.coach_clients set away_reason = null, away_from = null, away_until = null, away_note = null where id = (select v from t.ids where k = 'c_ana');
select t.as_admin();
select t.ok((select away_reason from public.coach_clients where id = (select v from t.ids where k = 'c_ana')) = 'injury', 'a client can''t change their own away note');

-- Both last trained long ago; only Bo (not away) is frozen
update public.coach_clients set status = 'active', last_session_at = now() - interval '200 days' where trainer_id = (select v from t.ids where k = 'trainer');
select public.coach_auto_freeze();
select t.ok((select status from public.coach_clients where id = (select v from t.ids where k = 'c_ana')) = 'active', 'auto-freeze skips a client who is away');
select t.ok((select status from public.coach_clients where id = (select v from t.ids where k = 'c_bo')) = 'frozen', 'and still freezes others');
update public.coach_clients set status = 'active', away_until = current_date - 30, away_from = current_date - 60 where id = (select v from t.ids where k = 'c_ana');
select public.coach_auto_freeze();
select t.ok((select status from public.coach_clients where id = (select v from t.ids where k = 'c_ana')) = 'frozen', 'two weeks after their return date, normal rules apply');
select 'ALL CLIENT AWAY TESTS PASSED';
