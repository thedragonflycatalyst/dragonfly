-- The shared library: suggestions wait for an admin; reports and hidden exercises; everyone reads approved additions.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('boss', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
insert into public.dragonfly_admins select v from t.ids where k = 'boss';
set client_min_messages = notice;
select t.as_user('trainer'); insert into public.coach_trainers (user_id, display_name) select v, k from t.ids where k = 'trainer';
select t.as_user('trainer2'); insert into public.coach_trainers (user_id, display_name) select v, k from t.ids where k = 'trainer2';
-- As the review function (service role): two suggestions waiting for an admin, one answered by the AI
select t.as_admin();
set client_min_messages = warning;
insert into public.coach_exercise_submissions (trainer_id, exercise, ai_decision, outcome, proposal) select v, '{"name":"Floor Press-Up"}', 'same', 'pending',
  '{"kind":"alias","ref":"lib:c-push-up","names":["Floor Press-Up","Ground Push"]}' from t.ids where k = 'trainer';
insert into public.coach_exercise_submissions (trainer_id, exercise, ai_decision, outcome, proposal) select v, '{"name":"EZ Close Bench"}', 'add', 'pending',
  '{"kind":"add","ref":"lib:x-ez-bar-close-grip-bench-press","row":["x-ez-bar-close-grip-bench-press","EZ-Bar Close-Grip Bench Press"]}' from t.ids where k = 'trainer';
insert into public.coach_exercise_submissions (trainer_id, exercise, ai_decision, outcome) select v, '{"name":"Wobble"}', 'needs_detail', 'needs_detail' from t.ids where k = 'trainer2';
set client_min_messages = notice;

select t.as_user('trainer');
select t.ok((select count(*) from public.coach_exercise_submissions) = 2, 'trainers see only their own suggestions');
select t.ok((select count(*) from public.coach_library_extra) = 0 and (select count(*) from public.coach_library_aliases) = 0, 'nothing joins the library before review');
select t.ok(t.refused($$select public.coach_review_submission((select id from public.coach_exercise_submissions limit 1), true)$$), 'trainers can''t approve suggestions');
select t.ok(t.refused($$insert into public.coach_library_extra (ref, data) values ('lib:x-my-move', '[]')$$), 'trainers can''t add to the library directly');
select t.ok(t.refused($$insert into public.coach_library_aliases (ref, alias) values ('lib:c-push-up', 'Anything')$$), 'trainers can''t add names directly');
select t.ok(t.refused($$update public.coach_exercise_submissions set outcome = 'approved'$$), 'trainers can''t mark their own suggestion approved');
select t.ok(t.refused($$insert into public.coach_exercise_submissions (trainer_id, exercise, ai_decision, outcome) values (auth.uid(), '{}', 'add', 'approved')$$), 'trainers can''t file their own review');

select t.as_user('boss');
select t.ok((select count(*) from public.coach_exercise_submissions where outcome = 'pending') = 2, 'admins see every pending suggestion');
select t.ok(public.coach_review_submission((select id from public.coach_exercise_submissions where ai_decision = 'same'), true, 'Good catch') = 'approved', 'an admin approves the extra names');
select t.ok(public.coach_review_submission((select id from public.coach_exercise_submissions where ai_decision = 'add'), false, 'Too close to the barbell version') = 'declined', 'an admin declines the new variation');
select t.ok(t.refused($$select public.coach_review_submission((select id from public.coach_exercise_submissions where ai_decision = 'same'), true)$$), 'a suggestion is reviewed once');

select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_library_aliases where ref = 'lib:c-push-up') = 2, 'approved names reach everyone');
select t.ok((select count(*) from public.coach_library_extra) = 0, 'declined variations stay out');

-- Reports
insert into public.coach_exercise_reports (ref, name, kind, note) values ('lib:c-push-up', 'Push-Up', 'redundant', 'Same as Floor Push-Up');
select t.ok(t.refused($$insert into public.coach_exercise_reports (ref, name, kind, user_id) values ('lib:c-push-up', 'Push-Up', 'unsafe', (select v from t.ids where k = 'trainer'))$$), 'you can''t report as someone else');
select t.ok(t.refused($$insert into public.coach_exercise_reports (ref, name, kind) values ('lib:c-push-up', 'Push-Up', 'boring')$$), 'the report kind must be one of the five');
update public.coach_exercise_reports set status = 'resolved';
select t.ok((select status = 'open' from public.coach_exercise_reports), 'reporters can''t close their own report');
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_exercise_reports) = 0, 'other people''s reports are private');
select t.as_user('boss');
update public.coach_exercise_reports set status = 'resolved', admin_note = 'Merged';
select t.ok((select status = 'resolved' from public.coach_exercise_reports), 'admins resolve reports');
select t.ok(t.refused($$update public.coach_exercise_reports set note = 'rewritten'$$), 'even admins can''t rewrite a report');

-- Hidden exercises
select t.as_user('trainer');
insert into public.coach_hidden_exercises (ref) values ('lib:c-burpee');
select t.ok((select count(*) from public.coach_hidden_exercises) = 1, 'you can hide an exercise');
select t.ok(t.refused($$insert into public.coach_hidden_exercises (user_id, ref) values ((select v from t.ids where k = 'trainer2'), 'lib:c-push-up')$$), 'you can''t hide things for someone else');
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_hidden_exercises) = 0, 'what you hide is private');
select t.as_user('trainer');
delete from public.coach_hidden_exercises where ref = 'lib:c-burpee';
select t.ok((select count(*) from public.coach_hidden_exercises) = 0, 'you can show it again');
