-- Dragonfly (coaching): chat. Private chats (trainer ↔ client, or teammates), group chats the trainer runs, and
-- broadcasts (one message delivered into each client's private chat). Texting-style: reactions, replies, photos,
-- video, voice notes, files, GIFs, shared workouts, seen receipts. New messages arrive through Supabase Realtime.

create table public.coach_chats (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,  -- the coaching account it belongs to
  kind text not null default 'direct' check (kind in ('direct', 'group')),
  title text check (char_length(title) <= 120),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  last_message_at timestamptz,
  last_preview text check (char_length(last_preview) <= 200),
  created_at timestamptz not null default now()
);
create index coach_chats_trainer_idx on public.coach_chats (trainer_id, last_message_at desc);

create table public.coach_chat_members (
  chat_id uuid not null references public.coach_chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('trainer', 'client')),
  name text not null default '' check (char_length(name) <= 120),
  muted boolean not null default false,
  archived boolean not null default false,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index coach_chat_members_user_idx on public.coach_chat_members (user_id);

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.coach_chats(id) on delete cascade,
  sender uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'image', 'video', 'audio', 'file', 'gif', 'workout', 'system')),
  body text check (char_length(body) <= 8000),
  path text check (char_length(path) <= 300),               -- coach-social: chat/{chat_id}/{name}
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object' and pg_column_size(meta) < 4000),
  reply_to uuid references public.coach_messages(id) on delete set null,
  broadcast_id uuid,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'text' or deleted_at is not null or char_length(body) >= 1)
);
create index coach_messages_chat_idx on public.coach_messages (chat_id, created_at desc);

create table public.coach_message_reactions (
  message_id uuid not null references public.coach_messages(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chat_id uuid not null references public.coach_chats(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table public.coach_broadcasts (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  client_ids uuid[] not null default '{}',
  last_sent_at timestamptz,
  last_body text check (char_length(last_body) <= 200),
  created_at timestamptz not null default now()
);
alter table public.coach_messages add constraint coach_messages_broadcast_fk foreign key (broadcast_id) references public.coach_broadcasts(id) on delete set null;

-- ---------------------------------------------------------------- helpers

create function public.coach_chat_member(p_chat uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.coach_chat_members where chat_id = p_chat and user_id = auth.uid()) $$;
-- Members, or a team owner viewing the trainer whose chat it is (read only)
create function public.coach_chat_visible(p_chat uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select public.coach_chat_member(p_chat) or exists (select 1 from public.coach_chats c where c.id = p_chat and c.trainer_id = public.coach_acting() and c.trainer_id <> auth.uid()) $$;

create function public.coach_person_name(p_user uuid, p_trainer uuid) returns text
language sql stable security definer set search_path = '' as
$$
  select coalesce(
    (select c.name from public.coach_clients c where c.user_id = p_user and c.trainer_id = p_trainer and c.status <> 'archived' limit 1),
    (select t.display_name from public.coach_trainers t where t.user_id = p_user),
    (select p.username from public.dragonfly_profiles p where p.user_id = p_user), 'Member')
$$;

-- Opens (or finds) the private chat with someone: your client, your trainer, or a teammate
create function public.coach_chat_direct(p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as
$$
declare me uuid := auth.uid(); tr uuid; v uuid;
begin
  if me is null or p_user is null or p_user = me then raise exception 'pick someone else' using errcode = '22023'; end if;
  if exists (select 1 from public.coach_clients c where c.trainer_id = me and c.user_id = p_user and c.status <> 'archived') then tr := me;
  elsif exists (select 1 from public.coach_clients c where c.trainer_id = p_user and c.user_id = me and c.status = 'active') then
    if not public.coach_perm(p_user, 'message_trainer') then raise exception 'messages_closed' using errcode = '42501'; end if;
    tr := p_user;
  elsif public.coach_teammate(p_user) then tr := me;
  else raise exception 'not someone you coach or train with' using errcode = '42501';
  end if;
  select c.id into v from public.coach_chats c
   where c.kind = 'direct' and exists (select 1 from public.coach_chat_members m where m.chat_id = c.id and m.user_id = me)
     and exists (select 1 from public.coach_chat_members m where m.chat_id = c.id and m.user_id = p_user)
   order by c.created_at limit 1;
  if v is not null then return v; end if;
  insert into public.coach_chats (trainer_id, kind) values (tr, 'direct') returning id into v;
  insert into public.coach_chat_members (chat_id, user_id, role, name) values
    (v, me, case when me = tr or public.coach_teammate(p_user) then 'trainer' else 'client' end, public.coach_person_name(me, tr)),
    (v, p_user, case when p_user = tr or public.coach_teammate(p_user) then 'trainer' else 'client' end, public.coach_person_name(p_user, tr));
  return v;
end
$$;

-- Trainer: a group chat with some of their (signed-up) clients
create function public.coach_chat_group(p_title text, p_clients uuid[]) returns uuid
language plpgsql security definer set search_path = '' as
$$
declare me uuid := auth.uid(); v uuid;
begin
  if not exists (select 1 from public.coach_trainers where user_id = me) then raise exception 'trainers only' using errcode = '42501'; end if;
  if char_length(coalesce(trim(p_title), '')) = 0 then raise exception 'name the group' using errcode = '22023'; end if;
  insert into public.coach_chats (trainer_id, kind, title) values (me, 'group', left(trim(p_title), 120)) returning id into v;
  insert into public.coach_chat_members (chat_id, user_id, role, name) values (v, me, 'trainer', public.coach_person_name(me, me));
  perform public.coach_chat_set_members(v, p_clients);
  return v;
end
$$;

-- Trainer: set who's in one of their group chats (clients without an account yet are skipped)
create function public.coach_chat_set_members(p_chat uuid, p_clients uuid[]) returns int
language plpgsql security definer set search_path = '' as
$$
declare me uuid := auth.uid(); n int;
begin
  if not exists (select 1 from public.coach_chats where id = p_chat and kind = 'group' and trainer_id = me) then
    raise exception 'not your group chat' using errcode = '42501';
  end if;
  delete from public.coach_chat_members m where m.chat_id = p_chat and m.user_id <> me
    and m.user_id not in (select c.user_id from public.coach_clients c where c.id = any (p_clients) and c.trainer_id = me and c.user_id is not null);
  insert into public.coach_chat_members (chat_id, user_id, role, name)
    select p_chat, c.user_id, 'client', c.name from public.coach_clients c
     where c.id = any (p_clients) and c.trainer_id = me and c.user_id is not null and c.status <> 'archived'
  on conflict do nothing;
  select count(*) - 1 into n from public.coach_chat_members where chat_id = p_chat;
  return n;
end
$$;

-- Trainer: send a broadcast; each client gets it in their private chat. Returns how many received it.
create function public.coach_broadcast_send(p_broadcast uuid, p_body text) returns int
language plpgsql security definer set search_path = '' as
$$
declare me uuid := auth.uid(); b public.coach_broadcasts%rowtype; c record; ch uuid; n int := 0;
begin
  select * into b from public.coach_broadcasts where id = p_broadcast and trainer_id = me;
  if not found then raise exception 'not your broadcast' using errcode = '42501'; end if;
  if char_length(coalesce(trim(p_body), '')) = 0 then raise exception 'write a message' using errcode = '22023'; end if;
  for c in select * from public.coach_clients where id = any (b.client_ids) and trainer_id = me and user_id is not null and status = 'active' loop
    ch := public.coach_chat_direct(c.user_id);
    insert into public.coach_messages (chat_id, sender, kind, body, broadcast_id) values (ch, me, 'text', left(p_body, 8000), b.id);
    n := n + 1;
  end loop;
  update public.coach_broadcasts set last_sent_at = now(), last_body = left(p_body, 200) where id = b.id;
  return n;
end
$$;

-- New message: sender must be allowed to message; the chat's preview moves; it pops back out of everyone's archive
create function public.coach_message_after() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  update public.coach_chats set last_message_at = new.created_at,
    last_preview = left(case new.kind when 'text' then new.body when 'image' then '📷 Photo' when 'video' then '🎬 Video' when 'audio' then '🎤 Voice message'
                                       when 'file' then '📄 ' || coalesce(new.meta ->> 'name', 'File') when 'gif' then 'GIF' when 'workout' then '💪 ' || coalesce(new.meta ->> 'title', 'Workout')
                                       else coalesce(new.body, '') end, 200)
   where id = new.chat_id;
  update public.coach_chat_members set archived = false where chat_id = new.chat_id and archived;
  update public.coach_chat_members set last_read_at = new.created_at where chat_id = new.chat_id and user_id = new.sender;
  return null;
end
$$;
create trigger coach_messages_after after insert on public.coach_messages for each row execute function public.coach_message_after();

create function public.coach_message_guard() returns trigger
language plpgsql security definer set search_path = '' as
$$
declare ch public.coach_chats%rowtype; r text;
begin
  select * into ch from public.coach_chats where id = new.chat_id;
  select role into r from public.coach_chat_members where chat_id = new.chat_id and user_id = new.sender;
  if r = 'client' and not public.coach_perm(ch.trainer_id, 'message_trainer') then raise exception 'messages_closed' using errcode = '42501'; end if;
  if new.path is not null and split_part(new.path, '/', 1) <> 'chat' or new.path is not null and split_part(new.path, '/', 2) <> new.chat_id::text then
    raise exception 'attachment is not in this chat' using errcode = '42501';
  end if;
  if new.reply_to is not null and not exists (select 1 from public.coach_messages m where m.id = new.reply_to and m.chat_id = new.chat_id) then
    raise exception 'reply is not in this chat' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger coach_messages_guard before insert on public.coach_messages for each row execute function public.coach_message_guard();

-- Reactions carry their chat (so realtime can be filtered by chat); it must match the message
create function public.coach_reaction_fill() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  select chat_id into new.chat_id from public.coach_messages where id = new.message_id;
  return new;
end
$$;
create trigger coach_message_reactions_fill before insert on public.coach_message_reactions for each row execute function public.coach_reaction_fill();

-- Who can read chat and community attachments: coach-social/{chat|community}/{id}/{name}
create function public.coach_social_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as
$$
  select split_part(p_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and case split_part(p_name, '/', 1)
    when 'chat' then public.coach_chat_visible(split_part(p_name, '/', 2)::uuid)
    when 'community' then public.coach_in_community(split_part(p_name, '/', 2)::uuid)
    else false end
$$;

-- ---------------------------------------------------------------- privileges and policies

revoke execute on function public.coach_message_after(), public.coach_message_guard(), public.coach_reaction_fill() from public, anon, authenticated;
revoke execute on function public.coach_chat_member(uuid), public.coach_chat_visible(uuid), public.coach_person_name(uuid, uuid), public.coach_chat_direct(uuid),
  public.coach_chat_group(text, uuid[]), public.coach_chat_set_members(uuid, uuid[]), public.coach_broadcast_send(uuid, text), public.coach_social_ok(text) from public, anon;
grant execute on function public.coach_chat_member(uuid), public.coach_chat_visible(uuid), public.coach_person_name(uuid, uuid), public.coach_chat_direct(uuid),
  public.coach_chat_group(text, uuid[]), public.coach_chat_set_members(uuid, uuid[]), public.coach_broadcast_send(uuid, text), public.coach_social_ok(text) to authenticated;

alter table public.coach_chats enable row level security;
alter table public.coach_chat_members enable row level security;
alter table public.coach_messages enable row level security;
alter table public.coach_message_reactions enable row level security;
alter table public.coach_broadcasts enable row level security;
revoke all on public.coach_chats, public.coach_chat_members, public.coach_messages, public.coach_message_reactions, public.coach_broadcasts from anon;
grant select on public.coach_chats, public.coach_chat_members to authenticated;
grant update (title) on public.coach_chats to authenticated;
grant update (muted, archived, last_read_at) on public.coach_chat_members to authenticated;
grant select, insert on public.coach_messages to authenticated;
grant update (body, edited_at, deleted_at) on public.coach_messages to authenticated;
grant select, insert, delete on public.coach_message_reactions to authenticated;
grant select, insert, update, delete on public.coach_broadcasts to authenticated;

create policy coach_chats_read on public.coach_chats for select to authenticated using (public.coach_chat_visible(id));
create policy coach_chats_rename on public.coach_chats for update to authenticated
  using (kind = 'group' and trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_chat_members_read on public.coach_chat_members for select to authenticated using (public.coach_chat_visible(chat_id));
create policy coach_chat_members_self on public.coach_chat_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Group chat owners can remove people (leaving is done by setting members through coach_chat_set_members)
create policy coach_messages_read on public.coach_messages for select to authenticated using (public.coach_chat_visible(chat_id));
create policy coach_messages_send on public.coach_messages for insert to authenticated
  with check (sender = (select auth.uid()) and public.coach_chat_member(chat_id) and kind <> 'system' and broadcast_id is null);
create policy coach_messages_edit on public.coach_messages for update to authenticated
  using (sender = (select auth.uid())) with check (sender = (select auth.uid()));
create policy coach_message_reactions_read on public.coach_message_reactions for select to authenticated using (public.coach_chat_visible(chat_id));
create policy coach_message_reactions_add on public.coach_message_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.coach_chat_member((select m.chat_id from public.coach_messages m where m.id = message_id)));
create policy coach_message_reactions_remove on public.coach_message_reactions for delete to authenticated using (user_id = (select auth.uid()));
create policy coach_broadcasts_trainer on public.coach_broadcasts for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select auth.uid()));
