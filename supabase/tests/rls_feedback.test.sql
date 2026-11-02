-- Feedback: people send it and see their own; admins see and answer everything.
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into t.ids values ('alex', gen_random_uuid()), ('bea', gen_random_uuid()), ('boss', gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at) select v, k || '@example.com', now() from t.ids;
insert into public.dragonfly_profiles select v, k from t.ids;
insert into public.dragonfly_admins select v from t.ids where k = 'boss';
set client_min_messages = notice;
select t.as_user('alex');
insert into public.dragonfly_feedback (kind, body, screen) values ('feature', 'Let me drag shortcuts around', '/coach');
insert into public.dragonfly_feedback (kind, body) values ('design', 'Bigger rest timer numbers');
select t.ok((select count(*) from public.dragonfly_feedback) = 2, 'you see what you sent');
select t.ok(t.refused($$insert into public.dragonfly_feedback (kind, body, user_id) values ('bug', 'pretend to be bea', (select v from t.ids where k = 'bea'))$$), 'you can''t send as someone else');
select t.ok(t.refused($$insert into public.dragonfly_feedback (kind, body, status) values ('bug', 'mark my own as done', 'done')$$), 'you can''t set a status');
select t.ok(t.refused($$insert into public.dragonfly_feedback (kind, body) values ('rant', 'not a kind')$$), 'the kind must be one of the four');
select t.ok(t.refused($$insert into public.dragonfly_feedback (kind, body) values ('bug', '  ')$$), 'empty feedback is refused');
update public.dragonfly_feedback set body = 'changed', status = 'done';
select t.ok((select count(*) from public.dragonfly_feedback where body = 'changed' or status = 'done') = 0, 'senders can''t edit or close their feedback');
select t.as_user('bea');
select t.ok((select count(*) from public.dragonfly_feedback) = 0, 'other people''s feedback is private');
select t.as_user('boss');
select t.ok((select count(*) from public.dragonfly_feedback) = 2, 'admins see everything');
update public.dragonfly_feedback set status = 'planned', reply = 'On the list for next week' where kind = 'feature';
select t.ok((select status = 'planned' and reply is not null from public.dragonfly_feedback where kind = 'feature'), 'admins can set a status and reply');
select t.ok(t.refused($$update public.dragonfly_feedback set body = 'rewritten' where kind = 'design'$$), 'even admins can''t rewrite what someone said');
select t.as_user('alex');
select t.ok((select reply from public.dragonfly_feedback where kind = 'feature') = 'On the list for next week', 'the sender sees the reply');
do $$ begin for i in 1..18 loop insert into public.dragonfly_feedback (kind, body) values ('other', 'idea number ' || i); end loop; end $$;
select t.ok(t.refused($$insert into public.dragonfly_feedback (kind, body) values ('other', 'one too many')$$), 'at most 20 a day');
