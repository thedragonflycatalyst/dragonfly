-- Row-level security tests for packages, payments, calendar, events, communities, resources, files, chat and the scale.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('trainer', gen_random_uuid()), ('trainer2', gen_random_uuid()), ('client', gen_random_uuid()), ('client2', gen_random_uuid()), ('stranger', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
set client_min_messages = notice;

select t.as_user('trainer');
insert into public.coach_trainers (user_id, display_name) select v, 'Dragonfly' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ana', 'client@example.com' from t.ids where k = 'trainer';
insert into public.coach_clients (trainer_id, first_name, email) select v, 'Ben', 'client2@example.com' from t.ids where k = 'trainer';
select t.as_user('client'); select public.coach_link_me();
select t.as_user('client2'); select public.coach_link_me();
select t.as_user('trainer2');
insert into public.coach_trainers (user_id, display_name) select v, 'Other' from t.ids where k = 'trainer2';
select t.as_admin();
create temp table ana as select id from public.coach_clients where first_name = 'Ana';
create temp table ben as select id from public.coach_clients where first_name = 'Ben';
grant select on ana, ben to authenticated;

-- ---------------------------------------------------------------- packages and payments
select t.as_user('trainer');
insert into public.coach_packages (trainer_id, name, price_cents, credits, valid_days) select v, '10 sessions', 60000, 10, 90 from t.ids where k = 'trainer';
insert into public.coach_packages (trainer_id, name, price_cents, visible) select v, 'Hidden VIP', 100000, false from t.ids where k = 'trainer';
insert into public.coach_packages (trainer_id, name, price_cents, client_ids) select v, 'Just for Ben', 5000, array[(select id from ben)] from t.ids where k = 'trainer';
select t.ok(t.refused($$insert into public.coach_payments (trainer_id, description, amount_cents, method) select v, 'fake', 100, 'stripe' from t.ids where k = 'trainer'$$), 'trainers cannot write Stripe payments themselves');
insert into public.coach_payments (trainer_id, client_id, description, amount_cents, method) select v, (select id from ana), 'Cash for 10 sessions', 60000, 'cash' from t.ids where k = 'trainer';
insert into public.coach_client_packages (trainer_id, client_id, name, credits_total) select v, (select id from ana), '10 sessions', 2 from t.ids where k = 'trainer';
select t.ok(t.refused($$insert into public.coach_vouchers (trainer_id, code, percent_off, amount_off_cents) select v, 'BOTH', 10, 100 from t.ids where k = 'trainer'$$), 'a voucher is a percent or an amount, not both');
insert into public.coach_vouchers (trainer_id, code, percent_off) select v, 'WELCOME10', 10 from t.ids where k = 'trainer';

select t.as_user('client');
select t.ok((select count(*) from public.coach_packages) = 1, 'clients see only visible packages meant for them');
select t.ok((select count(*) from public.coach_payments) = 1 and (select credits_total from public.coach_client_packages) = 2, 'clients see their payments and credits');
select t.ok((select count(*) from public.coach_vouchers) = 0, 'clients cannot list voucher codes');
update public.coach_client_packages set credits_used = 0, credits_total = 99;
select t.ok((select credits_total from public.coach_client_packages) = 2, 'clients cannot change their credits');
select t.as_user('client2');
select t.ok((select count(*) from public.coach_packages) = 2 and (select count(*) from public.coach_payments) = 0, 'a client-only package shows to that client; others'' payments stay private');
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_packages) + (select count(*) from public.coach_payments) + (select count(*) from public.coach_client_packages) = 0, 'another trainer sees none of it');
select t.ok(t.refused($$insert into public.coach_client_packages (trainer_id, client_id, name) select v, (select id from ana), 'x' from t.ids where k = 'trainer2'$$), 'another trainer cannot give packages to your client');

-- ---------------------------------------------------------------- events
select t.as_user('trainer');
insert into public.coach_events (trainer_id, title, starts_at, spaces, waitlist, credits) select v, 'Bootcamp', now() + interval '2 days', 1, true, 1 from t.ids where k = 'trainer';
insert into public.coach_events (trainer_id, title, starts_at, price_cents) select v, 'Workshop', now() + interval '3 days', 2500 from t.ids where k = 'trainer';
select t.as_admin();
create temp table ev as select id, title from public.coach_events;
grant select on ev to authenticated;
select t.as_user('client');
select t.ok(public.coach_event_join((select id from ev where title = 'Bootcamp')) = 'booked', 'a client with credits books a class');
select t.ok((select credits_used from public.coach_client_packages) = 1, 'booking used a credit');
select t.ok(public.coach_event_join((select id from ev where title = 'Workshop')) = 'pay', 'a paid event asks for payment');
select t.as_user('client2');
select t.ok(public.coach_event_join((select id from ev where title = 'Bootcamp')) = 'waitlist', 'a full class puts the next person on the waiting list');
select t.ok((select booked from public.coach_events where title = 'Bootcamp') = 1 and (select waiting from public.coach_events where title = 'Bootcamp') = 1, 'events keep booked and waiting counts');
select t.ok((select count(*) from public.coach_event_signups) = 1, 'clients only see their own signups');
select t.as_user('client');
select public.coach_event_leave((select id from ev where title = 'Bootcamp'));
select t.ok((select credits_used from public.coach_client_packages) = 0, 'cancelling gives the credit back');
select t.as_user('trainer');
select t.ok((select s.status from public.coach_event_signups s join public.coach_clients c on c.id = s.client_id where c.first_name = 'Ben') = 'waitlist', 'waitlisted client without credits stays waiting');
insert into public.coach_client_packages (trainer_id, client_id, name, credits_total) select v, (select id from ben), '5 classes', 5 from t.ids where k = 'trainer';
select t.as_user('client');
select t.ok(public.coach_event_join((select id from ev where title = 'Bootcamp')) = 'booked', 'a client with credits takes a free space');
select t.as_user('trainer');
select public.coach_event_leave((select id from ev where title = 'Bootcamp'), (select id from ana));
select t.ok((select s.status from public.coach_event_signups s join public.coach_clients c on c.id = s.client_id where c.first_name = 'Ben') = 'booked', 'when the trainer removes someone, the waiting list moves up');
select t.ok((select credits_used from public.coach_client_packages where name = '5 classes') = 1, 'promotion uses the waiting client''s credit');
select t.as_user('stranger');
select t.ok(t.refused($$select public.coach_event_join((select id from ev where title = 'Bootcamp'))$$), 'people who are not clients cannot join');
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_events) = 0, 'another trainer cannot see your events');

-- ---------------------------------------------------------------- calendar
select t.as_user('trainer');
insert into public.coach_availability (trainer_id, weekday, start_time, end_time) select v, d, '00:00', '23:59' from t.ids, generate_series(0, 6) d where k = 'trainer';
insert into public.coach_bookings (trainer_id, client_id, title, starts_at, repeat) select v, (select id from ana), 'Weekly PT', date_trunc('hour', now()) + interval '30 days', 'weekly' from t.ids where k = 'trainer';
select t.ok(t.refused($$insert into public.coach_bookings (trainer_id, client_id, title, starts_at) select v, (select id from ana), 'x', now() from t.ids where k = 'trainer2'$$), 'bookings must use your own clients');
select t.as_admin();
create temp table bk as select id from public.coach_bookings;
grant select on bk to authenticated;
select t.as_user('client');
select t.ok(public.coach_book_session((select v from t.ids where k = 'trainer'), date_trunc('hour', now()) + interval '2 days 4 hours', 60) is not null, 'a client books into open hours');
select t.ok(t.refused($$select public.coach_book_session((select v from t.ids where k = 'trainer'), date_trunc('hour', now()) + interval '2 days 4 hours 30 minutes', 60)$$), 'overlapping slots are refused');
select t.ok(t.refused($$select public.coach_book_session((select v from t.ids where k = 'trainer'), now() + interval '10 minutes', 60)$$), 'too-soon bookings are refused');
select t.ok((select count(*) from public.coach_bookings) = 2, 'clients see their own sessions');
select t.ok(t.refused($$select public.coach_book_session((select v from t.ids where k = 'trainer'), date_trunc('hour', now()) + interval '30 days', 60)$$), 'repeating sessions block their slots too');
select t.ok((select count(*) from public.coach_trainer_busy((select v from t.ids where k = 'trainer'), 40)) >= 5, 'clients can see when the trainer is busy');
select public.coach_cancel_session((select id from public.coach_bookings where repeat = 'weekly'), ((date_trunc('hour', now()) + interval '30 days') at time zone 'UTC')::date);
select t.ok((select cardinality(skipped) from public.coach_bookings where repeat = 'weekly') = 1, 'a client skips one date of a repeating session');
select t.as_user('client2');
select t.ok((select count(*) from public.coach_bookings) = 0, 'other clients don''t see them');
select t.as_user('stranger');
select t.ok(t.refused($$select * from public.coach_trainer_busy((select v from t.ids where k = 'trainer'))$$), 'strangers cannot see the trainer''s schedule');
select t.as_user('client2');
select t.ok(t.refused($$select public.coach_cancel_session((select id from bk limit 1), current_date + 40)$$), 'other clients cannot cancel them');
select t.as_user('trainer');
update public.coach_trainers set client_perms = client_perms || '{"book_sessions": false}' where user_id = (select v from t.ids where k = 'trainer');
update public.coach_bookings set done = array_append(done, current_date) where repeat = 'weekly';
select t.ok((select last_session_at is not null from public.coach_clients where first_name = 'Ana'), 'marking a session done records the client''s last session');
select t.as_user('client');
select t.ok(t.refused($$select public.coach_book_session((select v from t.ids where k = 'trainer'), date_trunc('hour', now()) + interval '5 days', 60)$$), 'self-booking can be switched off');

-- ---------------------------------------------------------------- communities and resources
select t.as_user('trainer');
insert into public.coach_communities (trainer_id, name) select v, 'Run club' from t.ids where k = 'trainer';
insert into public.coach_community_members (community_id, client_id, trainer_id) select m.id, (select id from ana), m.trainer_id from public.coach_communities m;
insert into public.coach_posts (community_id, body, pinned) select id, 'Welcome!', true from public.coach_communities;
insert into public.coach_resources (trainer_id, kind, title, body) select v, 'template', 'Welcome text', 'Hi {name}' from t.ids where k = 'trainer';
insert into public.coach_resources (trainer_id, kind, title, code) select v, 'offer', '20% off shakes', 'DFLY20' from t.ids where k = 'trainer';
insert into public.coach_trainer_details (user_id, address1, date_of_birth) select v, '1 Main St', '1990-05-15' from t.ids where k = 'trainer';
select t.as_admin();
create temp table cm as select id from public.coach_communities;
grant select on cm to authenticated;
select t.as_user('client');
select t.ok((select count(*) from public.coach_posts) = 1 and (select author_name from public.coach_posts) = 'Dragonfly', 'members read posts, with the author''s name');
insert into public.coach_posts (community_id, body) select id, 'Ran 5K!' from public.coach_communities;
select t.ok(t.refused($$insert into public.coach_posts (community_id, body, pinned) select id, 'Me first', true from public.coach_communities$$), 'clients cannot pin posts');
insert into public.coach_post_comments (post_id, body) select id, 'Thanks' from public.coach_posts where body = 'Welcome!';
select t.ok((select comments from public.coach_posts where body = 'Welcome!') = 1, 'comment counts are kept');
select t.ok((select count(*) from public.coach_resources) = 1 and (select kind from public.coach_resources) = 'offer', 'clients see offers but not message templates');
select t.ok((select count(*) from public.coach_trainer_details) = 0, 'clients never see the trainer''s address or birthday');
select t.as_user('client2');
select t.ok((select count(*) from public.coach_posts) + (select count(*) from public.coach_communities) = 0, 'non-members see nothing');
select t.ok(t.refused($$insert into public.coach_posts (community_id, body) select id, 'hi' from cm$$) , 'non-members cannot post');
select t.as_user('trainer');
delete from public.coach_posts where body = 'Ran 5K!';
select t.ok((select count(*) from public.coach_posts) = 1, 'the trainer can remove members'' posts');

-- ---------------------------------------------------------------- files library
insert into public.coach_library_files (trainer_id, name, path, size_bytes) select v, 'Meal guide.pdf', v || '/files/a.pdf', 1000 from t.ids where k = 'trainer';
insert into public.coach_library_files (trainer_id, name, path, size_bytes) select v, 'Private.pdf', v || '/files/b.pdf', 1000 from t.ids where k = 'trainer';
insert into public.coach_file_shares (file_id, client_id, trainer_id) select f.id, (select id from ana), f.trainer_id from public.coach_library_files f where name = 'Meal guide.pdf';
select t.ok(t.refused($$insert into public.coach_library_files (trainer_id, name, path, size_bytes) select v, 'x', 'elsewhere/files/x.pdf', 1 from t.ids where k = 'trainer'$$), 'files must be in the trainer''s folder');
select t.ok(public.coach_media_ok((select v from t.ids where k = 'trainer') || '/files/b.pdf'), 'the trainer can open their files');
select t.as_user('client');
select t.ok((select count(*) from public.coach_library_files) = 1 and (select name from public.coach_library_files) = 'Meal guide.pdf', 'clients see only files shared with them');
select t.ok(public.coach_media_ok((select v from t.ids where k = 'trainer') || '/files/a.pdf') and not public.coach_media_ok((select v from t.ids where k = 'trainer') || '/files/b.pdf'), 'and can only open those');

-- ---------------------------------------------------------------- chat
select t.as_user('client');
create temp table ch as select public.coach_chat_direct((select v from t.ids where k = 'trainer')) id;
select t.ok((select id from ch) = public.coach_chat_direct((select v from t.ids where k = 'trainer')), 'opening the chat again finds the same one');
insert into public.coach_messages (chat_id, body) select id, 'Hi coach!' from ch;
select t.ok(t.refused($$insert into public.coach_messages (chat_id, body, sender) select id, 'spoof', (select v from t.ids where k = 'trainer') from ch$$), 'cannot send as someone else');
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_messages) = 1 and (select last_preview from public.coach_chats) = 'Hi coach!', 'the trainer gets the message and the chat preview updates');
insert into public.coach_message_reactions (message_id, emoji) select id, '❤️' from public.coach_messages;
insert into public.coach_broadcasts (trainer_id, title, client_ids) select v, 'Everyone', array[(select id from ana), (select id from ben)] from t.ids where k = 'trainer';
select t.ok(public.coach_broadcast_send((select id from public.coach_broadcasts), 'Gym closed Monday') = 2, 'a broadcast reaches each client');
select t.ok((select count(*) from public.coach_chats) = 2, 'each in their own private chat');
create temp table gc as select public.coach_chat_group('Run club chat', array[(select id from ana)]) id;
select t.ok((select count(*) from public.coach_chat_members where chat_id = (select id from gc)) = 2, 'group chats include the chosen clients');
select t.as_user('client2');
select t.ok((select count(*) from public.coach_messages) = 1 and (select body from public.coach_messages) = 'Gym closed Monday', 'clients only see their own chats');
select t.ok(t.refused($$insert into public.coach_messages (chat_id, body) select id, 'let me in' from gc$$), 'non-members cannot post in a group');
select t.as_user('stranger');
select t.ok(t.refused($$select public.coach_chat_direct((select v from t.ids where k = 'trainer'))$$), 'strangers cannot open chats with a trainer');
select t.ok((select count(*) from public.coach_messages) + (select count(*) from public.coach_chats) = 0, 'and see no chats');
select t.as_user('trainer');
update public.coach_trainers set client_perms = client_perms || '{"message_trainer": false}' where user_id = (select v from t.ids where k = 'trainer');
select t.as_user('client');
select t.ok(t.refused($$insert into public.coach_messages (chat_id, body) select id, 'hello?' from ch$$), 'messaging can be switched off for clients');
update public.coach_chat_members set muted = true where chat_id = (select id from ch);
select t.ok((select muted from public.coach_chat_members where chat_id = (select id from ch) and user_id = (select v from t.ids where k = 'client')), 'clients can mute a chat');
select t.ok((select muted from public.coach_chat_members where chat_id = (select id from ch) and user_id = (select v from t.ids where k = 'trainer')) = false, 'muting only affects yourself');

-- ---------------------------------------------------------------- scale
select t.as_user('client');
insert into public.coach_weighins (weight_kg, metrics) values (80.5, '{"body_fat_pct": 25.1, "muscle_pct": 38}');
select t.ok(t.refused($$insert into public.coach_weighins (weight_kg, metrics) values (80, '{"shoe_size": 10}')$$), 'unknown scale readings are refused');
select t.ok(t.refused($$insert into public.coach_weighins (weight_kg, metrics) values (80, '{"body_fat_pct": "lots"}')$$), 'readings must be numbers');
insert into public.coach_scale_settings (metrics, goal_kg) values ('{weight,body_fat_pct,visceral_fat}', 75);
select t.as_user('trainer');
select t.ok((select count(*) from public.coach_weighins) = 1 and (select goal_kg from public.coach_scale_settings) = 75, 'the trainer sees their client''s weigh-ins');
select t.ok(t.refused($$insert into public.coach_weighins (user_id, weight_kg) select v, 90 from t.ids where k = 'client'$$), 'the trainer cannot add weigh-ins for them');
insert into public.coach_weighins (weight_kg) values (100);
select t.as_user('trainer2');
select t.ok((select count(*) from public.coach_weighins) = 0, 'other trainers see none');
select t.as_user('client');
select t.ok((select count(*) from public.coach_weighins) = 1, 'a client never sees their trainer''s own weigh-ins');

-- ---------------------------------------------------------------- issue reports
insert into public.dragonfly_issue_reports (body) values ('The timer froze');
select t.as_user('trainer');
select t.ok((select count(*) from public.dragonfly_issue_reports) = 0, 'reports are private to whoever sent them');
select t.as_admin();
insert into public.dragonfly_admins select v from t.ids where k = 'trainer';
select t.as_user('trainer');
select t.ok((select count(*) from public.dragonfly_issue_reports) = 1, 'the app admin reads every report');
select t.as_admin();
-- ---------------------------------------------------------------- review fixes
select t.as_user('trainer');
insert into public.coach_events (trainer_id, title, starts_at, credits) select v, 'Soon class', now() + interval '2 hours', 1 from t.ids where k = 'trainer';
insert into public.coach_client_packages (trainer_id, client_id, name, credits_total) select v, (select id from ana), 'Late test', 5 from t.ids where k = 'trainer';
select t.as_admin();
create temp table soon as select id from public.coach_events where title = 'Soon class';
grant select on soon to authenticated;
select t.as_user('client');
select t.ok(public.coach_event_join((select id from soon)) = 'booked', 'client books a class starting soon');
select t.ok(t.refused($$select public.coach_event_leave((select id from soon))$$), 'clients cannot drop out (and get credits back) inside the notice period');
select t.ok(t.refused($$select public.coach_cancel_session((select id from public.coach_bookings where booked_by = 'client' limit 1), current_date + 90)$$), 'cancelling must name the session''s real date');
select t.as_user('trainer2');
select t.ok(t.refused($$insert into public.coach_resources (trainer_id, kind, title, file_path) select v, 'media', 'Stolen', (select v from t.ids where k = 'trainer') || '/resources/x.pdf' from t.ids where k = 'trainer2'$$), 'resources can only point at your own files');
select t.as_user('trainer');
select t.ok(t.refused($$update public.coach_payments set stripe_session_id = 'cs_test_x' where method = 'cash'$$), 'trainers cannot attach Stripe checkouts to their records');
update public.coach_clients set status = 'frozen' where first_name = 'Ben';
select t.as_user('client2');
select t.ok((select count(*) from public.coach_messages) = 0, 'frozen clients lose chat access');
select t.as_admin();
\echo 'ALL BUSINESS AND SOCIAL TESTS PASSED'
