-- Engagement: surveys by link, testimonials only in the client's words and only published when they approve,
-- trainers can hide but not edit, the website sees only published ones; referral links create leads.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('ana', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;

select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Emmet' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, last_name, email) select v, 'Ana', 'Lopez', 'ana@example.com' from t.ids where k = 'trainer';
select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
select t.as_admin(); insert into t.ids select 'c_ana', id from public.coach_clients where first_name = 'Ana';
select t.as_user('ana'); select public.coach_link_me();

-- A sent survey (service role)
select t.as_admin();
insert into public.coach_outbox (trainer_id, client_id, purpose, kind, channel, body, status)
  select (select v from t.ids where k = 'trainer'), v, 'surveys', 'survey', 'app', 'How was training, 1-5?', 'sent' from t.ids where k = 'c_ana';
insert into t.ids select 'survey_tok', token from public.coach_outbox where kind = 'survey';
set role anon;
select t.ok((select trainer_name from public.coach_survey_view((select v from t.ids where k = 'survey_tok'))) = 'Emmet', 'the survey link shows who is asking');
select public.coach_survey_answer_link((select v from t.ids where k = 'survey_tok'), 5, 'Loving it');
select t.ok(t.refused($$select public.coach_survey_answer_link((select v from t.ids where k = 'survey_tok'), 9, null)$$), 'ratings are 1 to 5');
select t.ok(t.refused($$select public.coach_survey_answer_link(gen_random_uuid(), 3, null)$$), 'made-up survey links are refused');
select t.ok(t.refused($$select public.coach_survey_answer((select id from public.coach_outbox limit 1), 3, null)$$), 'the by-id answer is server-only');
select t.as_user('trainer');
select t.ok((select rating = 5 and comment = 'Loving it' from public.coach_survey_responses), 'the trainer sees the answer');
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_survey_responses) = 0, 'other trainers don''t');

-- Testimonials
select t.as_user('trainer');
select t.ok(t.refused($$insert into public.coach_testimonials (client_id, trainer_id, body, status) select v, (select v from t.ids where k = 'trainer'), 'Great!', 'draft' from t.ids where k = 'c_ana'$$), 'trainers can''t write testimonials');
select t.as_admin();
insert into public.coach_testimonials (client_id, trainer_id, source) select v, (select v from t.ids where k = 'trainer'), 'ask' from t.ids where k = 'c_ana';
insert into t.ids select 'tst_tok', token from public.coach_testimonials;
select t.ok(t.refused($$update public.coach_testimonials set status = 'published', approved_at = now(), body = null$$), 'nothing is published without words');
set role anon;
select t.ok((select count(*) from public.coach_public_testimonials()) = 0, 'the website shows nothing before approval');
select t.ok(public.coach_testimonial_submit((select v from t.ids where k = 'tst_tok'), 'Emmet made training fun again.', 'first_initial', false) = 'draft', 'the client can save a draft');
select t.ok((select count(*) from public.coach_public_testimonials()) = 0, 'a draft is not public');
select t.ok(public.coach_testimonial_submit((select v from t.ids where k = 'tst_tok'), 'Emmet made training fun again.', 'first_initial', true) = 'published', 'the client approves and it is published');
select t.ok((select display_name from public.coach_public_testimonials()) = 'Ana L.', 'shown with the name style they chose');
select t.ok(t.refused($$select * from public.coach_testimonials$$), 'the table itself is closed to visitors');
select t.as_user('trainer');
select t.ok(t.refused($$update public.coach_testimonials set body = 'Best trainer ever!!!'$$), 'trainers can''t change the words');
select t.ok(t.refused($$update public.coach_testimonials set status = 'hidden'$$), 'hiding needs a reason');
update public.coach_testimonials set status = 'hidden', hidden_reason = 'Mentions another client by name';
set role anon;
select t.ok((select count(*) from public.coach_public_testimonials()) = 0, 'hidden ones leave the website');
select t.ok(public.coach_testimonial_submit((select v from t.ids where k = 'tst_tok'), 'x', 'first_name', true) = 'hidden', 'a hidden one can''t be republished by link');
select t.as_user('trainer');
update public.coach_testimonials set status = 'published';
set role anon;
select t.ok(public.coach_testimonial_submit((select v from t.ids where k = 'tst_tok'), 'Emmet made training fun again.', 'first_name', false) = 'withdrawn', 'the client can withdraw');
select t.ok((select count(*) from public.coach_public_testimonials()) = 0, 'withdrawn ones leave the website');
select t.as_user('trainer');
select t.ok(t.refused($$update public.coach_testimonials set status = 'published'$$), 'a trainer can''t republish what the client withdrew');

-- Referrals
select t.as_user('ana');
select t.as_admin(); insert into t.ids values ('ref_code_holder', gen_random_uuid());
select t.as_user('ana');
create temp table if not exists rc (code text); grant all on rc to authenticated, anon;
insert into rc select public.coach_referral_code((select v from t.ids where k = 'c_ana'));
select t.ok((select code from rc) ~ '^[a-z0-9]{8}$', 'the client gets a referral link');
select t.ok((select public.coach_referral_code((select v from t.ids where k = 'c_ana'))) = (select code from rc), 'and the same one each time');
select t.as_user('trainer2');
select t.ok(t.refused($$select public.coach_referral_code((select v from t.ids where k = 'c_ana'))$$), 'other trainers can''t make links for someone else''s client');
set role anon;
select t.ok((select referrer_first from public.coach_referral_view((select code from rc))) = 'Ana', 'the link shows who referred them');
select public.coach_referral_submit((select code from rc), 'Sam Rivera', 'sam@example.com', '410-555-0100', 'Ana said you''re great');
select t.ok(t.refused($$select public.coach_referral_submit((select code from rc), 'No Contact', null, null, null)$$), 'a friend must leave an email or phone');
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_clients where status = 'lead' and email = 'sam@example.com' and source = 'Referred by Ana') = 1, 'the friend becomes a lead in the client pool');
select t.ok((select count(*) from public.coach_referral_signups) = 1, 'and the trainer sees the referral');
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_referral_signups) = 0, 'other trainers don''t');
\echo ALL ENGAGEMENT TESTS PASSED
