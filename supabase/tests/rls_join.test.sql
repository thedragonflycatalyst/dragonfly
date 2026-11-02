-- In-person sign-up with the trainer's QR code.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('newbie', gen_random_uuid()), ('invited', gen_random_uuid()), ('unconfirmed', gen_random_uuid()), ('other', gen_random_uuid()), ('texter', gen_random_uuid()), ('sneaky', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at, phone, phone_confirmed_at) select v, case when k in ('texter', 'sneaky') then null else k || '@example.com' end,
  case when k in ('unconfirmed', 'texter', 'sneaky') then null else now() end, case when k in ('texter', 'sneaky') then '1410555' || floor(random() * 10000)::text end, case when k in ('texter', 'sneaky') then now() end from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name, business_name) select v, 'Dragonfly', 'The Dragonfly Catalyst' from t.ids where k = 'trainer';
insert into public.coach_trainer_details (user_id, join_code) select v, 'Join1234567890abcdef' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Inez', 'invited@example.com' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Victor', 'victim@example.com' from t.ids where k = 'trainer';
select t.as_admin(); set role anon;
select t.ok((select trainer_name from public.coach_join_info('Join1234567890abcdef')) = 'Dragonfly', 'the sign-up page can show whose code it is before signing in');
select t.ok((select count(*) from public.coach_join_info('nope')) = 0, 'a wrong code shows nothing');
select t.ok(t.refused($$select public.coach_join('Join1234567890abcdef', 'A', 'B', '4105550107')$$), 'joining needs an account');
reset role;
select t.as_user('newbie');
select public.coach_join('Join1234567890abcdef', 'Nia', 'Brooks', '(410) 555-0101');
select t.ok((select status = 'active' and first_name = 'Nia' and source = 'QR sign-up' from public.coach_clients where user_id = (select v from t.ids where k = 'newbie')), 'a new person becomes an active client');
select t.ok((select phone from public.coach_clients where user_id = (select v from t.ids where k = 'newbie')) = '(410) 555-0101', 'with their phone number');
select t.ok(public.coach_join('Join1234567890abcdef', 'Nia', 'Brooks', '(410) 555-0101') = (select id from public.coach_clients where user_id = (select v from t.ids where k = 'newbie')), 'scanning again returns the same client');
select t.as_user('invited');
select public.coach_join('Join1234567890abcdef', 'Inez', 'Q', '410 555 0102');
select t.ok((select count(*) from public.coach_clients where lower(email) = 'invited@example.com') = 1 and (select status = 'active' from public.coach_clients where lower(email) = 'invited@example.com'), 'an invited client is linked, not duplicated');
select t.ok((select phone from public.coach_clients where lower(email) = 'invited@example.com') = '410 555 0102', 'and their phone number is saved');
select t.as_user('texter');
select public.coach_join('Join1234567890abcdef', 'Tia', 'Text', '4105550108', 'Tia@Example.com');
select t.ok((select email = 'tia@example.com' and status = 'active' from public.coach_clients where user_id = (select v from t.ids where k = 'texter')), 'a phone-verified person joins with the email they typed');
select t.as_user('sneaky');
select t.ok(t.refused($$select public.coach_join('Join1234567890abcdef', 'V', 'X', '4105550109', 'victim@example.com')$$), 'an unconfirmed email can''t claim someone else''s invited record');
select t.ok(t.refused($$select public.coach_join('Join1234567890abcdef', 'V', 'X', '4105550109', 'not-an-email')$$), 'phone-verified sign-ups still need a real email');
select t.as_user('unconfirmed');
select t.ok(t.refused($$select public.coach_join('Join1234567890abcdef', 'U', 'C', '4105550103')$$), 'the email must be confirmed first');
select t.as_user('other');
select t.ok(t.refused($$select public.coach_join('WrongCode1234567890x', 'O', 'T', '4105550104')$$), 'a wrong code is refused');
select t.ok(t.refused($$select public.coach_join('Join1234567890abcdef', '', 'T', '4105550105')$$), 'a first name is needed');
select t.ok(t.refused($$select public.coach_join('Join1234567890abcdef', 'O', 'T', '12')$$), 'a real phone number is needed');
select t.ok((select count(*) from public.coach_trainer_details) = 0, 'clients can''t read the trainer''s join code');
select t.as_user('trainer');
select t.ok(t.refused($$select public.coach_join('Join1234567890abcdef', 'Me', 'Me', '4105550106')$$), 'trainers can''t join themselves');
select t.ok(t.refused($$update public.coach_trainer_details set join_code = 'short'$$), 'codes must be long and random');
select t.ok((select count(*) from public.coach_clients where status = 'active') = 3, 'the trainer sees the new clients');
select t.ok((select user_id is null from public.coach_clients where email = 'victim@example.com'), 'the invited record is untouched');
select t.as_admin();
\echo 'ALL JOIN TESTS PASSED'
