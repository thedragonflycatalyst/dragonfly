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

-- AI decisions apply straight away; trainers can escalate; admins handle escalations and can take additions back
set client_min_messages = warning;
select t.as_admin();
insert into public.coach_exercise_submissions (trainer_id, exercise, ai_decision, outcome, reason) select v, '{"name":"Wall Sit Pulse"}', 'needs_detail', 'needs_detail', 'Say how it differs' from t.ids where k = 'trainer';
insert into public.coach_library_extra (ref, data) values ('lib:x-ai-added-move', '["x-ai-added-move","AI Added Move"]');
insert into public.coach_library_aliases (ref, alias) values ('lib:x-ai-added-move', 'Added Move');
set client_min_messages = notice;
select t.as_user('trainer');
select t.ok(t.refused($$select public.coach_escalate_submission((select id from public.coach_exercise_submissions where exercise->>'name' = 'Wall Sit Pulse'), 'help')$$), 'an escalation needs a real explanation');
select public.coach_escalate_submission((select id from public.coach_exercise_submissions where exercise->>'name' = 'Wall Sit Pulse'), 'It is a distinct isometric-plus-pulse drill used in rehab.');
select t.ok((select outcome = 'escalated' and escalated_from = 'needs_detail' from public.coach_exercise_submissions where exercise->>'name' = 'Wall Sit Pulse'), 'trainers can ask a person to look');
select t.ok(t.refused($$select public.coach_escalate_submission((select id from public.coach_exercise_submissions where exercise->>'name' = 'Wall Sit Pulse'), 'Again please, still stuck here.')$$), 'once is enough');
select t.as_user('trainer2');
select t.ok(t.refused($$select public.coach_escalate_submission((select id from public.coach_exercise_submissions where exercise->>'name' = 'Wall Sit Pulse'), 'Not mine but escalate it anyway.')$$), 'you can only escalate your own');
select t.ok(t.refused($$select public.coach_remove_library_item('lib:x-ai-added-move')$$), 'trainers can''t remove library items');
select t.as_user('boss');
select t.ok((select count(*) from public.coach_exercise_submissions where outcome = 'escalated') = 1, 'admins see escalations');
select t.ok(public.coach_review_submission((select id from public.coach_exercise_submissions where outcome = 'escalated'), false, 'Same as Wall Sit') = 'declined', 'admins answer escalations');
select public.coach_remove_library_item('lib:x-ai-added-move');
select t.ok((select count(*) from public.coach_library_extra where ref = 'lib:x-ai-added-move') = 0 and (select count(*) from public.coach_library_aliases where ref = 'lib:x-ai-added-move') = 0, 'admins can take an addition back');

-- Swap suggestions from real use: counts only, across everyone's logs
select t.as_user('trainer');
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'ana@example.com' from t.ids where k = 'trainer';
select t.as_admin();
insert into public.coach_logs (client_id, user_id, entries) select c.id, c.trainer_id, '[
  {"block_id":"a","ex":{"src":"lib","id":"c-leg-press","name":"Leg Press"},"swapped_from_ref":"lib:c-back-squat","swapped_from":"Back Squat","sets":[]},
  {"block_id":"b","ex":{"src":"lib","id":"c-goblet-squat","name":"Goblet Squat"},"swapped_from":"Back Squat","sets":[]}]' from public.coach_clients c;
insert into public.coach_logs (client_id, user_id, entries) select c.id, c.trainer_id, '[
  {"block_id":"a","ex":{"src":"lib","id":"c-leg-press","name":"Leg Press"},"swapped_from_ref":"lib:c-back-squat","sets":[]}]' from public.coach_clients c;
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_logs) = 0, 'other people''s logs stay private');
select t.ok((select ref = 'lib:c-leg-press' and uses = 2 from public.coach_popular_swaps('lib:c-back-squat', 'Back Squat') limit 1), 'the most common swap comes first, counted across everyone');
select t.ok((select count(*) from public.coach_popular_swaps('lib:c-back-squat', 'Back Squat')) = 2, 'older logs match by name');
select t.ok(t.refused($$select public.coach_popular_swaps('lib:c-back-squat')$$) = false, 'anyone signed in can ask');
select t.as_user('trainer');
insert into public.coach_exercises (trainer_id, name, gallery) values (auth.uid(), 'Grip check', '[{"path":"x/1.jpg","caption":"Thumbs around"}]');
select t.ok(t.refused($$insert into public.coach_exercises (trainer_id, name, gallery) values (auth.uid(), 'Too many', '[1,2,3,4,5,6,7,8,9]')$$), 'a gallery holds at most 8 pictures');

-- Beta "Report a problem" (issue #58): any exercise, context captured, one send per draft, reviewers and statuses
select t.as_user('trainer2');
create temp table rep1 as select public.coach_report_exercise(jsonb_build_object('ref', 'lib:c-goblet-squat', 'name', 'Goblet Squat', 'kind', 'instructions',
  'note', 'Step 2 says the bar; it''s a dumbbell', 'expected', 'Hold the dumbbell at your chest', 'client_key', '11111111-1111-1111-1111-111111111111',
  'variant', 'Dumbbell', 'revision', 'abc123', 'screen', 'session', 'app_version', '1.0.0')) as r;
grant select on rep1 to authenticated;
select t.ok((select (r->>'ref_no')::bigint > 0 and r->>'again' = 'false' from rep1), 'a report comes back with a reference number');
select t.ok((public.coach_report_exercise(jsonb_build_object('ref', 'lib:c-goblet-squat', 'name', 'Goblet Squat', 'kind', 'instructions', 'client_key', '11111111-1111-1111-1111-111111111111'))->>'ref_no')
  = (select r->>'ref_no' from rep1), 'sending the same draft again (a retry) doesn''t make a second report');
select t.ok((select count(*) from public.coach_exercise_reports where kind = 'instructions') = 1, 'one report');
select t.ok((select variant = 'Dumbbell' and revision = 'abc123' and screen = 'session' and expected ~ 'chest' from public.coach_exercise_reports where kind = 'instructions'), 'the exercise context and the expected fix are kept');
select t.ok(t.refused($$select public.coach_report_exercise('{"ref":"lib:c-push-up","name":"Push-Up","kind":"instructions","screenshot_path":"00000000-0000-0000-0000-000000000000/11111111-1111-1111-1111-111111111111.jpg"}')$$), 'a screenshot must be in your own folder');
select t.ok(t.refused($$select public.coach_review_report((select (r->>'id')::uuid from rep1), 'fixed')$$), 'reporters can''t review their own report');
-- A trainer's own exercise: that trainer reviews reports about it
select t.as_user('trainer');
create temp table mine as select id from public.coach_exercises where name = 'Grip check';
grant select on mine to authenticated;
select t.as_user('trainer2');
select public.coach_report_exercise(jsonb_build_object('ref', 'my:' || (select id from mine), 'name', 'Grip check', 'kind', 'media'));
select t.ok(t.refused($$select public.coach_report_exercise(jsonb_build_object('ref', 'my:00000000-0000-0000-0000-000000000000', 'name', 'Ghost', 'kind', 'media'))$$), 'a trainer exercise must exist');
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_exercise_reports) = 1 and (select kind from public.coach_exercise_reports) = 'media', 'the trainer sees reports about their own exercise only');
select public.coach_review_report((select id from public.coach_exercise_reports), 'reviewing', 'Looking into it', true);
select t.ok((select status = 'reviewing' and assignee = auth.uid() from public.coach_exercise_reports), 'and moves it to under review, assigned to them');
-- Admins see everything, triage, mark duplicates and keep the history
select t.as_user('boss');
select public.coach_review_report((select (r->>'id')::uuid from rep1), 'reviewing', null, true);
select public.coach_review_report((select (r->>'id')::uuid from rep1), 'fixed', 'Step 2 corrected');
select public.coach_review_report((select (r->>'id')::uuid from rep1), 'released');
select t.ok((select array_agg(status order by at) from public.coach_exercise_report_events where report_id = (select (r->>'id')::uuid from rep1) and status is not null) = array['open', 'reviewing', 'fixed', 'released'], 'every step is in the history');
select public.coach_review_report((select id from public.coach_exercise_reports where kind = 'media'), null, null, null, (select (r->>'ref_no')::bigint from rep1));
select t.ok((select status = 'duplicate' and duplicate_of = (select (r->>'id')::uuid from rep1) from public.coach_exercise_reports where kind = 'media'), 'a report can be marked a duplicate of another by its number');
select t.ok(t.refused($$select public.coach_review_report((select (r->>'id')::uuid from rep1), 'deleted')$$), 'only known statuses');
select t.as_user('trainer2');
select t.ok((select status from public.coach_exercise_reports where kind = 'instructions') = 'released', 'the reporter sees the status of their report');
select t.ok((select count(*) from public.coach_exercise_report_events) = 0, 'but not the reviewers'' history');
select t.ok(t.refused($$update public.coach_exercise_reports set expected = 'changed'$$) or (select expected from public.coach_exercise_reports where kind = 'instructions') ~ 'chest', 'or change what they sent');
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_exercise_reports where kind = 'instructions') = 0, 'other trainers don''t see library reports');
select t.ok(t.refused($$select public.coach_exercise_report_push()$$), 'the alert trigger isn''t callable');
select 'ALL LIBRARY TESTS PASSED';
