-- Credentials: everyone reads the directory, only admins edit it; your own record is private unless you show it.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('client', gen_random_uuid()), ('boss', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
insert into public.dragonfly_admins select v from t.ids where k = 'boss';
set client_min_messages = notice;
select t.as_user('client');
select t.ok((select count(*) from public.coach_credential_catalog) >= 30, 'everyone can browse the directory');
select t.ok(t.refused($$insert into public.coach_credential_catalog (id, name, org, url, discipline, audience, summary) values ('fake', 'Fake cert', 'Me', 'https://example.com', 'safety', 'both', 'x')$$), 'only admins add to the directory');
select t.as_user('trainer');
insert into public.coach_user_credentials (catalog_id, name, org, status, earned_on, expires_on, show_on_profile) values ('nasm-cpt', 'Certified Personal Trainer (CPT)', 'NASM', 'held', '2024-01-01', '2026-01-01', true);
insert into public.coach_user_credentials (catalog_id, name, status) values ('sfg1', 'SFG I Kettlebell Instructor', 'working');
insert into public.coach_user_credentials (name, status, file_path) select 'My own course', 'held', v || '/credentials/cert.pdf' from t.ids where k = 'trainer';
select t.ok((select count(*) from public.coach_user_credentials) = 3, 'you keep your own credentials');
select t.ok(t.refused($$insert into public.coach_user_credentials (name, file_path) select 'Sneaky', v || '/credentials/x.pdf' from t.ids where k = 'client'$$), 'a certificate file must be in your own folder');
select t.ok(t.refused($$insert into public.coach_user_credentials (user_id, name) select v, 'For someone else' from t.ids where k = 'client'$$), 'you can''t add credentials for someone else');
select t.as_user('client');
select t.ok((select count(*) from public.coach_user_credentials) = 1, 'others see only what you show on your profile (and only ones you hold)');
update public.coach_user_credentials set show_on_profile = false;
select t.ok((select count(*) from public.coach_user_credentials where show_on_profile) = 1, 'nobody else can change your record');
select t.as_user('trainer');
select t.ok(public.coach_media_ok((select v from t.ids where k = 'trainer') || '/credentials/cert.pdf'), 'you can open your own certificate');
select t.as_user('client');
select t.ok(not public.coach_media_ok((select v from t.ids where k = 'trainer') || '/credentials/cert.pdf'), 'nobody else can open your certificate file');
select t.as_user('boss');
update public.coach_credential_catalog set summary = 'Updated summary' where id = 'nasm-cpt';
select t.ok((select summary = 'Updated summary' from public.coach_credential_catalog where id = 'nasm-cpt'), 'admins keep the directory current');
\echo ALL CREDENTIALS TESTS PASSED
