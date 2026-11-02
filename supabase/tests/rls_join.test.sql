-- In-person sign-up with the trainer's QR code.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('newbie', gen_random_uuid()), ('invited', gen_random_uuid()), ('unconfirmed', gen_random_uuid()), ('other', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', case when k = 'unconfirmed' then null else now() end from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;
select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name, business_name) select v, 'Dragonfly', 'The Dragonfly Catalyst' from t.ids where k = 'trainer';
insert into public.coach_trainer_details (user_id, join_code) select v, 'Join1234567890abcdef' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Inez', 'invited@example.com' from t.ids where k = 'trainer';
select t.as_admin(); set role anon;
select t.ok((select trainer_name from public.coach_join_info('Join1234567890abcdef')) = 'Dragonfly', 'the sign-up page can show whose code it is before signing in');
select t.ok((select count(*) from public.coach_join_info('nope')) = 0, 'a wrong code shows nothing');
select t.ok(t.refused($$select public.coach_join('Join1234567890abcdef', 'A', 'B')$$), 'joining needs an account');
reset role;
select t.as_user('newbie');
select public.coach_join('Join1234567890abcdef', 'Nia', 'Brooks');
select t.ok((select status = 'active' and first_name = 'Nia' and source = 'QR sign-up' from public.coach_clients where user_id = (select v from t.ids where k = 'newbie')), 'a new person becomes an active client');
select t.ok(public.coach_join('Join1234567890abcdef', 'Nia', 'Brooks') = (select id from public.coach_clients where user_id = (select v from t.ids where k = 'newbie')), 'scanning again returns the same client');
select t.as_user('invited');
select public.coach_join('Join1234567890abcdef', 'Inez', 'Q');
select t.ok((select count(*) from public.coach_clients where lower(email) = 'invited@example.com') = 1 and (select status = 'active' from public.coach_clients where lower(email) = 'invited@example.com'), 'an invited client is linked, not duplicated');
select t.as_user('unconfirmed');
select t.ok(t.refused($$select public.coach_join('Join1234567890abcdef', 'U', 'C')$$), 'the email must be confirmed first');
select t.as_user('other');
select t.ok(t.refused($$select public.coach_join('WrongCode1234567890x', 'O', 'T')$$), 'a wrong code is refused');
select t.ok(t.refused($$select public.coach_join('Join1234567890abcdef', '', 'T')$$), 'a first name is needed');
select t.ok((select count(*) from public.coach_trainer_details) = 0, 'clients can''t read the trainer''s join code');
select t.as_user('trainer');
select t.ok(t.refused($$select public.coach_join('Join1234567890abcdef', 'Me', 'Me')$$), 'trainers can''t join themselves');
select t.ok(t.refused($$update public.coach_trainer_details set join_code = 'short'$$), 'codes must be long and random');
select t.ok((select count(*) from public.coach_clients where status = 'active') = 2, 'the trainer sees both new clients');
select t.as_admin();
\echo 'ALL JOIN TESTS PASSED'
