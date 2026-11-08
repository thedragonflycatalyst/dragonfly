-- Consents: each person sees and records only their own; records can't be edited or deleted.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('alex', gen_random_uuid()), ('blair', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('alex');
insert into public.coach_user_consents (kind, version, granted) values ('ai_photos', 1, true);
insert into public.coach_user_consents (kind, version, granted) values ('ai_photos', 1, false);
select t.ok((select granted from public.coach_consent_current('ai_photos')) = false, 'the newest answer counts (withdrawn)');
select t.ok(t.refused($$insert into public.coach_user_consents (user_id, kind, version, granted) select v, 'ai_photos', 1, true from t.ids where k = 'blair'$$), 'you can''t consent for someone else');
select t.ok(t.refused($$insert into public.coach_user_consents (kind, version, granted) values ('anything', 1, true)$$), 'only known consent kinds');
select t.ok(t.refused($$update public.coach_user_consents set granted = true$$), 'consent records can''t be edited');
select t.ok(t.refused($$delete from public.coach_user_consents$$), 'consent records can''t be deleted');
select t.as_user('blair');
select t.ok((select count(*) from public.coach_user_consents) = 0, 'nobody sees someone else''s consents');
select t.ok((select count(*) from public.coach_consent_current('ai_photos')) = 0, 'no answer yet means no consent');
set role anon;
select t.ok(t.refused($$select count(*) from public.coach_user_consents$$), 'signed-out visitors see nothing');
\echo ALL CONSENT TESTS PASSED
