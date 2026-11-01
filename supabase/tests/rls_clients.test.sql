-- Row-level security tests for the Clients tab: pool, freeze, profile, groups, notes, measurements,
-- photos/files, forms + health questionnaire, habits. Run with: supabase/tests/run.sh
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()),
  ('client', gen_random_uuid()), ('lead', gen_random_uuid()), ('outsider', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;

-- ---------------------------------------------------------------- setup
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Dragonfly' from t.ids where k = 'trainer';
select t.ok((select count(*) from public.coach_forms where kind = 'health') = 1, 'a new trainer starts with the health questionnaire');
insert into public.coach_clients (trainer_id, first_name, last_name, email, sex, date_of_birth, height_cm, goals)
  select v, 'Ana', 'Client', 'client@example.com', 'female', date '1990-05-01', 165, 'Run a 5K' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email, status, source)
  select v, 'Pool', 'lead@example.com', 'lead', 'Website' from t.ids where k = 'trainer';
select t.ok((select name from public.coach_clients where email = 'client@example.com') = 'Ana Client', 'full name is built from first and last');
select t.ok((select count(*) from public.coach_form_requests where kind = 'health') = 1, 'the health questionnaire is sent to a new client, not to a lead');
insert into public.coach_groups (trainer_id, name) select v, 'Mornings' from t.ids where k = 'trainer';
insert into public.coach_group_members (group_id, client_id, trainer_id)
  select g.id, c.id, g.trainer_id from public.coach_groups g, public.coach_clients c where c.first_name = 'Ana';
insert into public.coach_notes (client_id, trainer_id, body) select id, trainer_id, 'Left knee: avoid deep lunges' from public.coach_clients where first_name = 'Ana';
insert into public.coach_habits (client_id, trainer_id, title, days_per_week) select id, trainer_id, 'Walk 8,000 steps', 5 from public.coach_clients where first_name = 'Ana';
select t.ok(t.refused($$update public.coach_clients set status = 'active' where first_name = 'Pool' returning 1$$)
  or (select status from public.coach_clients where first_name = 'Pool') = 'lead', 'a lead cannot be marked active without signing in');

select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
select t.as_admin();
create temp table ana_id as select id, trainer_id from public.coach_clients where first_name = 'Ana';
grant select on ana_id to authenticated;
select t.as_user('trainer2');
select t.ok(t.refused($$insert into public.coach_groups (trainer_id, name) select auth.uid(), 'Mine';
  insert into public.coach_group_members (group_id, client_id, trainer_id) select g.id, a.id, auth.uid() from public.coach_groups g, ana_id a$$),
  'another trainer cannot put someone else''s client in their group');
select t.ok(t.refused($$insert into public.coach_measurements (client_id, trainer_id, weight_kg) select id, auth.uid(), 70 from ana_id$$)
  and t.refused($$insert into public.coach_measurements (client_id, trainer_id, weight_kg) select id, trainer_id, 70 from ana_id$$),
  'another trainer cannot add measurements for someone else''s client');
select t.ok((select count(*) from public.coach_notes) + (select count(*) from public.coach_form_requests) + (select count(*) from public.coach_habits) = 0,
  'another trainer sees none of it');
select t.ok(public.coach_storage_ok((select trainer_id || '/' || id || '/photos/x.jpg' from ana_id)) = false, 'another trainer cannot reach the client''s photos');

-- ---------------------------------------------------------------- leads are never linked
select t.as_user('lead');
select t.ok(public.coach_link_me() = 0, 'signing in does not link a client-pool lead');

-- ---------------------------------------------------------------- the client
select t.as_user('client');
select t.ok(public.coach_link_me() = 1, 'the invited client links on first sign-in');
select t.ok((select count(*) from public.coach_notes) = 0, 'client cannot read the trainer''s notes');
select t.ok((select count(*) from public.coach_forms) = 0, 'client cannot browse the trainer''s form templates');
select t.ok((select count(*) from public.coach_groups) = 0, 'client cannot see groups');
select t.ok((select count(*) from public.coach_habits) = 1, 'client sees their habit');
select t.ok(public.coach_storage_ok((select trainer_id || '/' || id || '/photos/x.jpg' from ana_id)), 'client can reach their own photo folder');
select t.ok(public.coach_storage_ok((select trainer_id || '/' || id || '/secret/x.jpg' from ana_id)) = false, 'only photos and files folders are allowed');

-- profile and onboarding
select public.coach_update_my_profile((select id from ana_id), '555-0100', 'female', date '1990-05-01', 166, 'Run a 5K in spring', array['Running','Strength'], true);
select t.ok((select height_cm = 166 and onboarded_at is not null and 'Running' = any(interests) from public.coach_clients), 'client completes onboarding and edits their profile');
select t.ok(t.refused($$select public.coach_update_my_profile((select id from public.coach_clients where false), null, null, null, null, null, null, false)$$),
  'client cannot edit a record that is not theirs');
select t.ok(t.refused($$update public.coach_clients set status = 'active', goals = 'hacked'$$) or (select goals from public.coach_clients) = 'Run a 5K in spring',
  'client cannot edit their record directly');

-- health questionnaire
select t.ok(t.refused($$select public.coach_submit_form((select id from public.coach_form_requests), '{"heart":"no"}')$$), 'a form with missing required answers is refused');
select public.coach_submit_form((select id from public.coach_form_requests),
  '{"heart":"no","chest":"no","dizzy":"no","chronic":"yes","meds":"no","joints":"no","supervised":"no","pregnancy":"no","details":"Asthma","signature":"Ana Client"}');
select t.ok((select status = 'completed' and flagged from public.coach_form_requests), 'a yes answer flags the questionnaire for the trainer');
select t.ok(t.refused($$select public.coach_submit_form((select id from public.coach_form_requests), '{}')$$), 'a submitted form cannot be resubmitted');

-- measurements, photos, files, habits
insert into public.coach_measurements (client_id, trainer_id, weight_kg, waist_cm) select id, trainer_id, 68.4, 74 from ana_id;
select t.ok(t.refused($$insert into public.coach_measurements (client_id, trainer_id, note) select id, trainer_id, 'empty' from ana_id$$), 'a measurement needs at least one number');
insert into public.coach_photos (client_id, trainer_id, pose, path) select id, trainer_id, 'front', trainer_id || '/' || id || '/photos/a.jpg' from ana_id;
select t.ok(t.refused($$insert into public.coach_photos (client_id, trainer_id, path) select id, trainer_id, 'elsewhere/a.jpg' from ana_id$$), 'a photo path must be the client''s own folder');
insert into public.coach_habit_checks (habit_id, day) select id, current_date from public.coach_habits;
select t.ok((select count(*) from public.coach_habit_checks) = 1, 'client ticks off a habit');

-- ---------------------------------------------------------------- trainer sees the client's entries
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_measurements) = 1 and (select count(*) from public.coach_photos) = 1
  and (select count(*) from public.coach_habit_checks) = 1, 'trainer sees the client''s measurements, photos and habit ticks');
select t.ok((select flagged from public.coach_form_requests), 'trainer sees the flagged questionnaire');

-- ---------------------------------------------------------------- freezing
update public.coach_clients set status = 'frozen' where first_name = 'Ana';
select t.ok((select frozen_reason = 'manual' and frozen_at is not null from public.coach_clients where first_name = 'Ana'), 'manual freeze is recorded');
select t.as_user('client');
select t.ok((select count(*) from public.coach_measurements) + (select count(*) from public.coach_habits) = 0, 'a frozen client loses access to their data');
select t.ok((select status from public.coach_clients) = 'frozen', 'a frozen client can still see that they are frozen');
select t.ok(t.refused($$insert into public.coach_measurements (client_id, trainer_id, weight_kg) select id, trainer_id, 68 from ana_id$$), 'a frozen client cannot add entries');
select t.ok(public.coach_storage_ok((select trainer_id || '/' || id || '/photos/x.jpg' from ana_id)) = false, 'a frozen client cannot reach their files');
select t.as_user('trainer');
update public.coach_clients set status = 'active' where first_name = 'Ana';
select t.ok((select status = 'active' and frozen_at is null from public.coach_clients where first_name = 'Ana'), 'unfreezing restores access');

-- automatic freeze after inactivity (only for clients whose sessions are tracked)
select t.as_admin();
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Untracked', 'untracked@example.com' from t.ids where k = 'trainer';
update public.coach_clients set last_session_at = now() - interval '91 days' where first_name = 'Ana';
select t.ok(public.coach_auto_freeze() = 1, 'auto-freeze catches a client with no session in 90 days');
select t.ok((select status = 'frozen' and frozen_reason = 'inactive' from public.coach_clients where first_name = 'Ana'), 'auto-freeze is marked as inactivity');
update public.coach_clients set status = 'active' where first_name = 'Ana';
update public.coach_clients set last_session_at = now() - interval '30 days' where first_name = 'Ana';
select t.ok(public.coach_auto_freeze() = 0, 'a client with a recent session is not frozen');
select t.as_user('trainer');
select t.ok(t.refused($$select public.coach_auto_freeze()$$), 'only the scheduled job can run auto-freeze');
select t.as_admin();
\echo 'ALL CLIENTS-TAB TESTS PASSED'
