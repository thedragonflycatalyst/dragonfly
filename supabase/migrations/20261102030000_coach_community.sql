-- Dragonfly (coaching): the habit library, communities, resources, the trainer's file library, and settings.

-- ---------------------------------------------------------------- habit library

create table public.coach_habit_library (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  details text check (char_length(details) <= 1000),
  icon text not null default '✅' check (char_length(icon) between 1 and 16),
  color text not null default '#0a7a70' check (color ~ '^#[0-9a-fA-F]{6}$'),
  once boolean not null default false,                      -- a one-off (e.g. "Book a physio appointment")
  days_per_week smallint not null default 7 check (days_per_week between 1 and 7),
  coaching boolean not null default true,                   -- show misses in check-ins
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.coach_habits
  add column library_id uuid references public.coach_habit_library(id) on delete set null,
  add column icon text check (char_length(icon) between 1 and 16),
  add column color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  add column once boolean not null default false;

-- ---------------------------------------------------------------- communities

create table public.coach_communities (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  cover text check (char_length(cover) <= 300),
  all_clients boolean not null default false,               -- every active client is a member
  clients_can_post boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.coach_community_members (
  community_id uuid not null references public.coach_communities(id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_id, client_id)
);
create trigger coach_community_members_guard before insert or update on public.coach_community_members for each row execute function public.coach_child_guard();

create table public.coach_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.coach_communities(id) on delete cascade,
  author uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default '' check (char_length(author_name) <= 120),
  body text not null check (char_length(body) between 1 and 5000),
  image_path text check (char_length(image_path) <= 300),
  pinned boolean not null default false,
  comments int not null default 0,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index coach_posts_community_idx on public.coach_posts (community_id, created_at desc);
create table public.coach_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.coach_posts(id) on delete cascade,
  author uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default '' check (char_length(author_name) <= 120),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table public.coach_post_reactions (
  post_id uuid not null references public.coach_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

-- Can the signed-in person see this community (its trainer or a teammate-owner viewing them, or a member client)?
create function public.coach_in_community(p_community uuid) returns boolean
language sql stable security definer set search_path = '' as
$$
  select exists (
    select 1 from public.coach_communities m
     where m.id = p_community and (
       m.trainer_id = public.coach_acting()
       or (not m.archived and exists (select 1 from public.coach_clients c where c.trainer_id = m.trainer_id and c.user_id = auth.uid() and c.status = 'active'
                                       and public.coach_perm(m.trainer_id, 'join_communities')
                                       and (m.all_clients or exists (select 1 from public.coach_community_members cm where cm.community_id = m.id and cm.client_id = c.id))))))
$$;
create function public.coach_can_post(p_community uuid) returns boolean
language sql stable security definer set search_path = '' as
$$
  select public.coach_in_community(p_community) and exists (
    select 1 from public.coach_communities m where m.id = p_community and (m.trainer_id = auth.uid() or m.clients_can_post))
$$;
create function public.coach_post_community(p_post uuid) returns uuid
language sql stable security definer set search_path = '' as
$$ select community_id from public.coach_posts where id = p_post $$;
create function public.coach_moderates_post(p_post uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.coach_posts p join public.coach_communities m on m.id = p.community_id where p.id = p_post and m.trainer_id = public.coach_acting_write()) $$;

-- Authors' display names are filled in from their profile; comment counts kept on the post
create function public.coach_post_fill() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  new.author_name := coalesce(
    (select t.display_name from public.coach_trainers t where t.user_id = new.author),
    (select c.first_name || coalesce(' ' || left(nullif(c.last_name, ''), 1) || '.', '') from public.coach_clients c where c.user_id = new.author and c.status = 'active' limit 1),
    (select p.username from public.dragonfly_profiles p where p.user_id = new.author), 'Member');
  return new;
end
$$;
create trigger coach_posts_fill before insert on public.coach_posts for each row execute function public.coach_post_fill();
create trigger coach_post_comments_fill before insert on public.coach_post_comments for each row execute function public.coach_post_fill();
create function public.coach_post_count() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  update public.coach_posts set comments = (select count(*) from public.coach_post_comments where post_id = coalesce(new.post_id, old.post_id)) where id = coalesce(new.post_id, old.post_id);
  return null;
end
$$;
create trigger coach_post_comments_count after insert or delete on public.coach_post_comments for each row execute function public.coach_post_count();

-- ---------------------------------------------------------------- resources

create table public.coach_resources (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  kind text not null check (kind in ('template', 'offer', 'media')),
  title text not null check (char_length(title) between 1 and 160),
  body text check (char_length(body) <= 10000),             -- template text / offer details / media description
  url text check (url ~ '^https?://' and char_length(url) <= 1000),
  file_path text check (char_length(file_path) <= 300),     -- coach-media: {trainer}/resources/{name}
  file_name text check (char_length(file_name) <= 200),
  mime text check (char_length(mime) <= 120),
  size_bytes bigint check (size_bytes between 0 and 104857600),
  cover text check (char_length(cover) <= 300),
  code text check (char_length(code) <= 40),                -- offers: promo code
  price_text text check (char_length(price_text) <= 60),    -- offers: "$99 (save $40)"
  expires_on date,
  audience text not null default 'all' check (audience in ('all', 'clients', 'none')),
  client_ids uuid[] not null default '{}',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger coach_resources_touch before update on public.coach_resources for each row execute function public.coach_touch();

-- ---------------------------------------------------------------- file library (Files)

create table public.coach_library_files (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  path text not null unique check (char_length(path) <= 300),   -- coach-media: {trainer}/files/{name}
  size_bytes bigint not null default 0 check (size_bytes between 0 and 104857600),
  mime text check (char_length(mime) <= 120),
  folder text check (char_length(folder) <= 80),
  created_at timestamptz not null default now()
);
create table public.coach_file_shares (
  file_id uuid not null references public.coach_library_files(id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (file_id, client_id)
);
create trigger coach_file_shares_guard before insert or update on public.coach_file_shares for each row execute function public.coach_child_guard();

-- 10 GB per trainer; the path must sit in the trainer's own files folder
create function public.coach_library_guard() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if split_part(new.path, '/', 1) <> new.trainer_id::text or split_part(new.path, '/', 2) <> 'files' then
    raise exception 'file path does not match this trainer' using errcode = '42501';
  end if;
  if (select coalesce(sum(size_bytes), 0) from public.coach_library_files where trainer_id = new.trainer_id and id <> new.id) + new.size_bytes > 10737418240 then
    raise exception 'storage_full' using errcode = '22023';
  end if;
  return new;
end
$$;
create trigger coach_library_files_guard before insert or update on public.coach_library_files for each row execute function public.coach_library_guard();

-- ---------------------------------------------------------------- trainer settings

-- Private details (address, birthday): only the trainer (and a team owner) see these, never clients
create table public.coach_trainer_details (
  user_id uuid primary key references public.coach_trainers(user_id) on delete cascade,
  first_name text check (char_length(first_name) <= 80),
  last_name text check (char_length(last_name) <= 80),
  phone text check (char_length(phone) <= 40),
  address1 text check (char_length(address1) <= 160),
  address2 text check (char_length(address2) <= 160),
  city text check (char_length(city) <= 80),
  region text check (char_length(region) <= 80),
  postcode text check (char_length(postcode) <= 20),
  country text check (char_length(country) <= 80),
  date_of_birth date,
  updated_at timestamptz not null default now()
);
alter table public.coach_trainers
  add column brand_color text check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  add column logo text check (char_length(logo) <= 300),
  add column welcome text check (char_length(welcome) <= 1000),
  add column unit_prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(unit_prefs) = 'object'),
  add column notify jsonb not null default '{}'::jsonb check (jsonb_typeof(notify) = 'object');
-- What each team trainer can see and do (owners always can)
alter table public.coach_team_members add column perms jsonb not null default '{"financials": false, "packages": true, "events": true}'::jsonb
  check (jsonb_typeof(perms) = 'object');
grant update (perms) on public.coach_team_members to authenticated;

-- App admins (the Dragonfly owner) read issue reports
create table public.dragonfly_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create function public.dragonfly_is_admin() returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.dragonfly_admins where user_id = auth.uid()) $$;
create table public.dragonfly_issue_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  app text not null default 'coach' check (char_length(app) <= 40),
  body text not null check (char_length(body) between 1 and 4000),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object' and pg_column_size(context) < 4000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- storage helpers learn the new folders

create or replace function public.coach_media_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as
$$
  select case split_part(p_name, '/', 2)
    when 'files' then
      public.coach_manages_text(split_part(p_name, '/', 1))
      or exists (select 1 from public.coach_library_files f join public.coach_file_shares s on s.file_id = f.id
                   join public.coach_clients c on c.id = s.client_id
                  where f.path = p_name and c.user_id = auth.uid() and c.status = 'active')
    when 'resources' then
      public.coach_manages_text(split_part(p_name, '/', 1))
      or exists (select 1 from public.coach_resources r where r.file_path = p_name and not r.archived and r.kind <> 'template'
                    and r.trainer_id in (select public.coach_my_trainer_ids()))
    else split_part(p_name, '/', 2) in ('exercises', 'covers', 'branding') and (
      public.coach_manages_text(split_part(p_name, '/', 1)) or public.coach_teammate_text(split_part(p_name, '/', 1))
      or exists (select 1 from public.coach_clients c
                  where c.trainer_id::text = split_part(p_name, '/', 1) and c.user_id = auth.uid() and c.status = 'active'))
  end
$$;

-- ---------------------------------------------------------------- privileges and policies

revoke execute on function public.coach_post_fill(), public.coach_post_count(), public.coach_library_guard() from public, anon, authenticated;
revoke execute on function public.coach_in_community(uuid), public.coach_can_post(uuid), public.coach_post_community(uuid),
  public.coach_moderates_post(uuid), public.dragonfly_is_admin() from public, anon;
grant execute on function public.coach_in_community(uuid), public.coach_can_post(uuid), public.coach_post_community(uuid),
  public.coach_moderates_post(uuid), public.dragonfly_is_admin() to authenticated;

alter table public.coach_habit_library enable row level security;
alter table public.coach_communities enable row level security;
alter table public.coach_community_members enable row level security;
alter table public.coach_posts enable row level security;
alter table public.coach_post_comments enable row level security;
alter table public.coach_post_reactions enable row level security;
alter table public.coach_resources enable row level security;
alter table public.coach_library_files enable row level security;
alter table public.coach_file_shares enable row level security;
alter table public.coach_trainer_details enable row level security;
alter table public.dragonfly_admins enable row level security;
alter table public.dragonfly_issue_reports enable row level security;
revoke all on public.coach_habit_library, public.coach_communities, public.coach_community_members, public.coach_posts, public.coach_post_comments,
  public.coach_post_reactions, public.coach_resources, public.coach_library_files, public.coach_file_shares, public.coach_trainer_details,
  public.dragonfly_admins, public.dragonfly_issue_reports from anon;
grant select, insert, update, delete on public.coach_habit_library, public.coach_communities, public.coach_community_members,
  public.coach_post_reactions, public.coach_resources, public.coach_library_files, public.coach_file_shares, public.coach_trainer_details to authenticated;
grant select, insert, delete on public.coach_posts, public.coach_post_comments to authenticated;
grant update (body, pinned, edited_at) on public.coach_posts to authenticated;
grant select on public.dragonfly_admins to authenticated;
grant select, insert on public.dragonfly_issue_reports to authenticated;
grant update (resolved) on public.dragonfly_issue_reports to authenticated;

create policy coach_habit_library_trainer on public.coach_habit_library for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_communities_trainer on public.coach_communities for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_communities_member on public.coach_communities for select to authenticated using (public.coach_in_community(id));
create policy coach_community_members_trainer on public.coach_community_members for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));

create policy coach_posts_read on public.coach_posts for select to authenticated using (public.coach_in_community(community_id));
create policy coach_posts_add on public.coach_posts for insert to authenticated
  with check (author = (select auth.uid()) and public.coach_can_post(community_id)
              and (not pinned or exists (select 1 from public.coach_communities m where m.id = community_id and m.trainer_id = (select auth.uid()))));
create policy coach_posts_edit on public.coach_posts for update to authenticated
  using (author = (select auth.uid()) or public.coach_moderates_post(id)) with check (public.coach_in_community(community_id));
create policy coach_posts_remove on public.coach_posts for delete to authenticated
  using (author = (select auth.uid()) or public.coach_moderates_post(id));
create policy coach_post_comments_read on public.coach_post_comments for select to authenticated using (public.coach_in_community(public.coach_post_community(post_id)));
create policy coach_post_comments_add on public.coach_post_comments for insert to authenticated
  with check (author = (select auth.uid()) and public.coach_in_community(public.coach_post_community(post_id)));
create policy coach_post_comments_remove on public.coach_post_comments for delete to authenticated
  using (author = (select auth.uid()) or public.coach_moderates_post(post_id));
create policy coach_post_reactions_read on public.coach_post_reactions for select to authenticated using (public.coach_in_community(public.coach_post_community(post_id)));
create policy coach_post_reactions_own on public.coach_post_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.coach_in_community(public.coach_post_community(post_id)));
create policy coach_post_reactions_remove on public.coach_post_reactions for delete to authenticated using (user_id = (select auth.uid()));

create policy coach_resources_trainer on public.coach_resources for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_resources_client on public.coach_resources for select to authenticated
  using (kind <> 'template' and not archived and audience <> 'none' and trainer_id in (select public.coach_my_trainer_ids())
         and (expires_on is null or expires_on >= current_date)
         and (audience = 'all' or public.coach_my_client_id(trainer_id) = any (client_ids)));

create policy coach_library_files_trainer on public.coach_library_files for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_library_files_client on public.coach_library_files for select to authenticated
  using (exists (select 1 from public.coach_file_shares s where s.file_id = coach_library_files.id and public.coach_is_client(s.client_id)));
create policy coach_file_shares_trainer on public.coach_file_shares for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_file_shares_client on public.coach_file_shares for select to authenticated using (public.coach_is_client(client_id));

create policy coach_trainer_details_own on public.coach_trainer_details for all to authenticated
  using (user_id = (select public.coach_acting())) with check (user_id = (select public.coach_acting_write()));

create policy dragonfly_admins_self on public.dragonfly_admins for select to authenticated using (user_id = (select auth.uid()));
create policy dragonfly_issue_reports_add on public.dragonfly_issue_reports for insert to authenticated with check (user_id = (select auth.uid()));
create policy dragonfly_issue_reports_read on public.dragonfly_issue_reports for select to authenticated
  using (user_id = (select auth.uid()) or public.dragonfly_is_admin());
create policy dragonfly_issue_reports_resolve on public.dragonfly_issue_reports for update to authenticated
  using (public.dragonfly_is_admin()) with check (public.dragonfly_is_admin());
