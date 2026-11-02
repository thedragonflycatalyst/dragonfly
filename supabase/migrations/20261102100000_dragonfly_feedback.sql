-- Feedback from inside the apps: feature ideas, design/UI suggestions, things that broke.
-- Anyone signed in can send it and see what they sent (with your reply and status); Dragonfly admins see everything.
create table public.dragonfly_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  app text not null default 'coach' check (app in ('coach', 'lapis', 'uploader', 'phoenix', 'books')),
  kind text not null check (kind in ('feature', 'design', 'bug', 'other')),
  body text not null check (char_length(btrim(body)) between 3 and 4000),
  screen text check (char_length(screen) <= 200),
  device text check (char_length(device) <= 200),
  status text not null default 'new' check (status in ('new', 'planned', 'done', 'declined')),
  reply text check (char_length(reply) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dragonfly_feedback_user on public.dragonfly_feedback (user_id, created_at desc);
create index dragonfly_feedback_new on public.dragonfly_feedback (status, created_at desc);
alter table public.dragonfly_feedback enable row level security;

create policy dragonfly_feedback_send on public.dragonfly_feedback for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'new' and reply is null);
create policy dragonfly_feedback_read on public.dragonfly_feedback for select to authenticated
  using (user_id = (select auth.uid()) or public.dragonfly_is_admin());
create policy dragonfly_feedback_answer on public.dragonfly_feedback for update to authenticated
  using (public.dragonfly_is_admin()) with check (public.dragonfly_is_admin());
create policy dragonfly_feedback_remove on public.dragonfly_feedback for delete to authenticated
  using (public.dragonfly_is_admin());

-- Senders can't change anything after sending; admins only change the status and reply. At most 20 a day each.
create function public.dragonfly_feedback_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.dragonfly_feedback where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
      raise exception 'feedback_limit' using errcode = 'P0001';
    end if;
    new.created_at := now(); new.updated_at := now();
  else
    if new.user_id <> old.user_id or new.kind <> old.kind or new.body <> old.body or new.app <> old.app
       or new.created_at <> old.created_at or new.screen is distinct from old.screen or new.device is distinct from old.device then
      raise exception 'only the status and reply can change' using errcode = 'P0001';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger dragonfly_feedback_guard before insert or update on public.dragonfly_feedback for each row execute function public.dragonfly_feedback_guard();
revoke all on function public.dragonfly_feedback_guard() from public, anon, authenticated;

grant select, insert, update, delete on public.dragonfly_feedback to authenticated;
