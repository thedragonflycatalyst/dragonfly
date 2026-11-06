-- Shared library additions: everyone signed in can read them; only the review function (service role) writes them.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer'); insert into public.coach_trainers (user_id, display_name) select v, k from t.ids where k = 'trainer';
select t.as_user('trainer2'); insert into public.coach_trainers (user_id, display_name) select v, k from t.ids where k = 'trainer2';
select t.as_admin();
set client_min_messages = warning;
-- As the review function: one addition, one extra name, one review each
insert into public.coach_library_extra (ref, data) values ('lib:x-ez-bar-close-grip-bench-press', '["x-ez-bar-close-grip-bench-press","EZ-Bar Close-Grip Bench Press"]');
insert into public.coach_library_aliases (ref, alias) values ('lib:c-push-up', 'Floor Press-Up');
insert into public.coach_exercise_submissions (trainer_id, exercise, outcome) select v, '{"name":"Floor Press-Up"}', 'alias' from t.ids where k = 'trainer';
insert into public.coach_exercise_submissions (trainer_id, exercise, outcome) select v, '{"name":"Wobble"}', 'needs_detail' from t.ids where k = 'trainer2';
set client_min_messages = notice;
select t.ok(t.refused($$insert into public.coach_library_aliases (ref, alias) values ('lib:c-push-up', 'FLOOR PRESS-UP')$$), 'the same extra name can''t be added twice');
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_library_extra) = 1 and (select count(*) from public.coach_library_aliases) = 1, 'trainers read the additions');
select t.ok((select count(*) from public.coach_exercise_submissions) = 1, 'trainers see only their own reviews');
select t.ok(t.refused($$insert into public.coach_library_extra (ref, data) values ('lib:x-my-move', '[]')$$), 'trainers can''t add to the library directly');
select t.ok(t.refused($$insert into public.coach_library_aliases (ref, alias) values ('lib:c-push-up', 'Anything')$$), 'trainers can''t add names directly');
select t.ok(t.refused($$insert into public.coach_exercise_submissions (trainer_id, exercise, outcome) values (auth.uid(), '{}', 'added')$$), 'trainers can''t record their own review');
select t.ok(t.refused($$update public.coach_library_extra set data = '[]'$$) and t.refused($$delete from public.coach_library_aliases$$), 'trainers can''t change or remove additions');
select t.as_admin();
select t.ok(t.refused($$insert into public.coach_library_extra (ref, data) values ('c-not-an-extra', '[]')$$), 'additions use their own x- references');
