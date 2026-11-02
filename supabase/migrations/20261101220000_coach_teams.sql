-- Dragonfly (coaching): teams.
-- A trainer can work solo or own a team. The owner adds trainers by email; each trainer keeps their own
-- clients, workouts, programs, meal plans and folders. The food library (custom foods) is shared by the team.
--
-- The owner can open any of their trainers' accounts. The app then sends the header
--   x-dragonfly-trainer: <trainer user id>        (whose account is being viewed)
--   x-dragonfly-edit: 1                            (only when the owner switched on emergency editing)
-- coach_acting() resolves whose data the request is about; every trainer policy compares against it, so
-- while viewing, the owner sees exactly that trainer's data and nothing else. Writes while viewing need
-- the edit header (coach_acting_write()).

create table public.coach_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.coach_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.coach_teams(id) on delete cascade,
  trainer_id uuid references public.coach_trainers(user_id) on delete cascade,  -- set when they join
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  role text not null default 'trainer' check (role in ('owner', 'trainer')),
  status text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  created_at timestamptz not null default now()
);
create unique index coach_team_members_email on public.coach_team_members (team_id, lower(email));
create unique index coach_team_members_trainer on public.coach_team_members (trainer_id) where status <> 'removed';  -- one team per trainer
create index coach_team_members_team_idx on public.coach_team_members (team_id);

-- ---------------------------------------------------------------- who is acting

-- True when the signed-in trainer owns a team that `tid` is an active member of
create function public.coach_owner_of(tid uuid) returns boolean
language sql stable security definer set search_path = '' as
$$
  select exists (select 1 from public.coach_teams t join public.coach_team_members m on m.team_id = t.id
                  where t.owner_id = auth.uid() and m.trainer_id = tid and m.status = 'active' and m.role = 'trainer')
$$;
create function public.coach_manages(tid uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select tid = auth.uid() or public.coach_owner_of(tid) $$;
-- Same for a storage path segment (no cast errors on odd names)
create function public.coach_manages_text(p text) returns boolean
language sql stable security definer set search_path = '' as
$$ select p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and public.coach_manages(p::uuid) $$;

-- The trainer whose data this request is about: the one being viewed (owners only), otherwise yourself
create function public.coach_acting() returns uuid
language plpgsql stable security definer set search_path = '' as
$$
declare h text; t uuid;
begin
  begin h := coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-dragonfly-trainer'; exception when others then h := null; end;
  if h ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    t := h::uuid;
    if t <> auth.uid() and public.coach_owner_of(t) then return t; end if;
  end if;
  return auth.uid();
end
$$;
-- Writes while viewing someone else's account need emergency editing switched on
create function public.coach_acting_write() returns uuid
language plpgsql stable security definer set search_path = '' as
$$
declare t uuid := public.coach_acting(); e text;
begin
  if t = auth.uid() then return t; end if;
  begin e := coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-dragonfly-edit'; exception when others then e := null; end;
  return case when e = '1' then t else null end;
end
$$;
-- Teammates (for the shared food library and seeing each other's names)
create function public.coach_teammate(tid uuid) returns boolean
language sql stable security definer set search_path = '' as
$$
  select exists (
    select 1 from public.coach_team_members a join public.coach_team_members b on a.team_id = b.team_id
     where a.trainer_id = auth.uid() and a.status = 'active' and b.trainer_id = tid and b.status = 'active')
$$;

create function public.coach_teammate_text(p text) returns boolean
language sql stable security definer set search_path = '' as
$$ select p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and public.coach_teammate(p::uuid) $$;

-- Teams the signed-in trainer owns or actively belongs to (for the team tables' own policies, without recursion)
create function public.coach_my_team_ids() returns setof uuid
language sql stable security definer set search_path = '' as
$$
  select id from public.coach_teams where owner_id = auth.uid()
  union select team_id from public.coach_team_members where trainer_id = auth.uid() and status = 'active'
$$;

-- ---------------------------------------------------------------- existing helpers learn about teams

create or replace function public.coach_owns_client(cid uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.coach_clients c where c.id = cid and c.trainer_id = public.coach_acting()) $$;

create or replace function public.coach_storage_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as
$$
  select exists (
    select 1 from public.coach_clients c
     where c.id::text = split_part(p_name, '/', 2) and c.trainer_id::text = split_part(p_name, '/', 1)
       and split_part(p_name, '/', 3) in ('photos', 'files', 'meals')
       and (public.coach_manages(c.trainer_id) or (c.user_id = auth.uid() and c.status = 'active')))
$$;
create or replace function public.coach_media_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as
$$
  select split_part(p_name, '/', 2) in ('exercises', 'covers') and (
    public.coach_manages_text(split_part(p_name, '/', 1)) or public.coach_teammate_text(split_part(p_name, '/', 1))
    or exists (select 1 from public.coach_clients c
                where c.trainer_id::text = split_part(p_name, '/', 1) and c.user_id = auth.uid() and c.status = 'active'))
$$;

create or replace function public.coach_assign_program(p_program uuid, p_client uuid, p_start date) returns int
language plpgsql security definer set search_path = '' as
$$
declare v_prog public.coach_programs%rowtype; v_n int := 0; s jsonb; w public.coach_workouts%rowtype; me uuid := public.coach_acting_write();
begin
  select * into v_prog from public.coach_programs where id = p_program and trainer_id = me;
  if me is null or not found or not public.coach_owns_client(p_client) then
    raise exception 'not your program or client' using errcode = '42501';
  end if;
  for s in select * from jsonb_array_elements(v_prog.schedule) loop
    select * into w from public.coach_workouts where id = (s->>'workout_id')::uuid and trainer_id = me;
    continue when not found;
    insert into public.coach_assignments (trainer_id, client_id, workout_id, program_id, scheduled_on, title, snapshot)
    values (me, p_client, w.id, v_prog.id, p_start + ((s->>'week')::int - 1) * 7 + ((s->>'day')::int - 1), w.name, w.blocks);
    v_n := v_n + 1;
  end loop;
  return v_n;
end
$$;

create or replace function public.coach_people() returns table (user_id uuid, username text, relation text)
language sql stable security definer set search_path = '' as
$$
  select p.user_id, p.username, 'client' from public.coach_clients c join public.dragonfly_profiles p on p.user_id = c.user_id
    where c.trainer_id = public.coach_acting()
  union
  select p.user_id, p.username, 'trainer' from public.coach_clients c join public.dragonfly_profiles p on p.user_id = c.trainer_id
    where c.user_id = auth.uid() and c.status <> 'archived'
$$;

-- ---------------------------------------------------------------- policies: compare with the acting trainer
do $$
declare r record;
begin
  for r in select * from (values
    ('coach_clients', 'coach_clients_trainer'), ('coach_client_notes', 'coach_notes_trainer'), ('coach_exercises', 'coach_exercises_trainer'),
    ('coach_workouts', 'coach_workouts_trainer'), ('coach_programs', 'coach_programs_trainer'), ('coach_assignments', 'coach_assignments_trainer'),
    ('coach_groups', 'coach_groups_trainer'), ('coach_group_members', 'coach_group_members_trainer'), ('coach_notes', 'coach_notes_trainer'),
    ('coach_forms', 'coach_forms_trainer'), ('coach_measurements', 'coach_measurements_trainer'), ('coach_photos', 'coach_photos_trainer'),
    ('coach_files', 'coach_files_trainer'), ('coach_form_requests', 'coach_form_requests_trainer'), ('coach_habits', 'coach_habits_trainer'),
    ('coach_workout_folders', 'coach_workout_folders_trainer'), ('coach_exercise_favorites', 'coach_exercise_favorites_trainer'),
    ('coach_nutrition_folders', 'coach_nutrition_folders_trainer'), ('coach_nutrition_plans', 'coach_nutrition_plans_trainer'),
    ('coach_nutrition_plan_clients', 'coach_nutrition_plan_clients_trainer')) as t(tbl, pol)
  loop
    if to_regclass('public.' || r.tbl) is null then continue; end if;
    execute format('drop policy if exists %I on public.%I', r.pol, r.tbl);
    execute format('create policy %I on public.%I for all to authenticated using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()))', r.pol, r.tbl);
  end loop;
end $$;

-- Custom foods are the team's shared library: teammates see each other's, each edits their own
drop policy coach_foods_trainer on public.coach_foods;
create policy coach_foods_read on public.coach_foods for select to authenticated
  using (trainer_id = (select public.coach_acting()) or public.coach_teammate(trainer_id) or public.coach_manages(trainer_id));
create policy coach_foods_write on public.coach_foods for insert to authenticated with check (trainer_id = (select public.coach_acting_write()));
create policy coach_foods_change on public.coach_foods for update to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_foods_remove on public.coach_foods for delete to authenticated using (trainer_id = (select public.coach_acting_write()));

-- Trainer profiles: teammates and the owner can read; the owner can update their trainers' profiles
drop policy coach_trainers_read on public.coach_trainers;
create policy coach_trainers_read on public.coach_trainers for select to authenticated
  using (user_id = (select auth.uid()) or user_id in (select public.coach_my_trainer_ids()) or public.coach_teammate(user_id) or public.coach_owner_of(user_id));
drop policy coach_trainers_update on public.coach_trainers;
create policy coach_trainers_update on public.coach_trainers for update to authenticated
  using (user_id = (select public.coach_acting())) with check (user_id = (select public.coach_acting_write()));

-- ---------------------------------------------------------------- team management

-- Owner: create your team (you become its owner member)
create function public.coach_team_create(p_name text) returns uuid
language plpgsql security definer set search_path = '' as
$$
declare v_team uuid; v_email text; v_name text;
begin
  if not exists (select 1 from public.coach_trainers where user_id = auth.uid()) then raise exception 'trainers only' using errcode = '42501'; end if;
  if exists (select 1 from public.coach_team_members where trainer_id = auth.uid() and status <> 'removed') then raise exception 'already_on_a_team' using errcode = 'P0001'; end if;
  select email into v_email from auth.users where id = auth.uid();
  select display_name into v_name from public.coach_trainers where user_id = auth.uid();
  insert into public.coach_teams (owner_id, name) values (auth.uid(), left(trim(p_name), 80)) returning id into v_team;
  insert into public.coach_team_members (team_id, trainer_id, email, display_name, role, status)
  values (v_team, auth.uid(), v_email, coalesce(nullif(v_name, ''), 'Owner'), 'owner', 'active');
  return v_team;
end
$$;

-- Owner: add a trainer by email (the app then calls coach-invite to email them)
create function public.coach_team_add(p_email text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as
$$
declare v_team uuid; v_id uuid; v_email text := lower(trim(p_email));
begin
  select id into v_team from public.coach_teams where owner_id = auth.uid();
  if v_team is null then raise exception 'no_team' using errcode = '42501'; end if;
  if v_email = (select lower(email) from auth.users where id = auth.uid()) then raise exception 'own_email' using errcode = 'P0001'; end if;
  insert into public.coach_team_members (team_id, email, display_name) values (v_team, v_email, left(trim(p_name), 80))
  on conflict (team_id, lower(email)) do update set status = case when public.coach_team_members.status = 'removed' then 'invited' else public.coach_team_members.status end,
    display_name = excluded.display_name
  returning id into v_id;
  return v_id;
end
$$;

-- Owner: take a trainer off the team. Their account, clients and library stay theirs.
create function public.coach_team_remove(p_member uuid) returns void
language plpgsql security definer set search_path = '' as
$$
begin
  update public.coach_team_members m set status = 'removed'
   where m.id = p_member and m.role = 'trainer' and m.team_id in (select id from public.coach_teams where owner_id = auth.uid());
  if not found then raise exception 'not your team member' using errcode = '42501'; end if;
end
$$;

-- Anyone signing in: join any team that invited this (confirmed) email; becomes a trainer if needed
create function public.coach_join_team() returns int
language plpgsql security definer set search_path = '' as
$$
declare v_email text; m record; v_n int := 0;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  for m in select * from public.coach_team_members where status = 'invited' and trainer_id is null and lower(email) = lower(v_email) order by created_at loop
    exit when exists (select 1 from public.coach_team_members where trainer_id = auth.uid() and status <> 'removed');
    insert into public.coach_trainers (user_id, display_name) values (auth.uid(), m.display_name) on conflict (user_id) do nothing;
    update public.coach_team_members set trainer_id = auth.uid(), status = 'active' where id = m.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end
$$;

-- Owner: give one of your trainers a copy of a workout, program or meal plan
create function public.coach_copy_to_trainer(p_kind text, p_id uuid, p_trainer uuid) returns uuid
language plpgsql security definer set search_path = '' as
$$
declare v_new uuid; me uuid := auth.uid(); v_prog public.coach_programs%rowtype; v_wid uuid; v_copy uuid; v_map jsonb := '{}';
begin
  if not (p_trainer = me or public.coach_owner_of(p_trainer)) then raise exception 'not your team member' using errcode = '42501'; end if;
  if p_kind = 'workout' then
    insert into public.coach_workouts (trainer_id, name, description, blocks, cover)
      select p_trainer, name, description, blocks, cover from public.coach_workouts where id = p_id and public.coach_manages(trainer_id) returning id into v_new;
  elsif p_kind = 'program' then
    -- Programs point at workouts, so their workouts are copied too and the schedule remapped
    select * into v_prog from public.coach_programs where id = p_id and public.coach_manages(trainer_id);
    if found then
      for v_wid in select distinct (d->>'workout_id')::uuid from jsonb_array_elements(v_prog.schedule) d loop
        insert into public.coach_workouts (trainer_id, name, description, blocks, cover)
          select p_trainer, name, description, blocks, cover from public.coach_workouts where id = v_wid and trainer_id = v_prog.trainer_id
          returning id into v_copy;
        if v_copy is not null then v_map := v_map || jsonb_build_object(v_wid::text, v_copy::text); end if;
        v_copy := null;
      end loop;
      insert into public.coach_programs (trainer_id, name, description, weeks, schedule, cover)
        select p_trainer, v_prog.name, v_prog.description, v_prog.weeks,
          coalesce((select jsonb_agg(jsonb_set(d, '{workout_id}', v_map -> (d->>'workout_id')))
                      from jsonb_array_elements(v_prog.schedule) d where v_map ? (d->>'workout_id')), '[]'),
          v_prog.cover
        returning id into v_new;
    end if;
  elsif p_kind = 'plan' then
    insert into public.coach_nutrition_plans (trainer_id, name, description, notes, cover, targets, meals)
      select p_trainer, name, description, notes, cover, targets, meals from public.coach_nutrition_plans where id = p_id and public.coach_manages(trainer_id) returning id into v_new;
  else
    raise exception 'unknown kind' using errcode = '22023';
  end if;
  if v_new is null then raise exception 'not found' using errcode = '42501'; end if;
  return v_new;
end
$$;

revoke execute on function public.coach_owner_of(uuid), public.coach_manages(uuid), public.coach_manages_text(text), public.coach_acting(), public.coach_acting_write(),
  public.coach_teammate(uuid), public.coach_teammate_text(text), public.coach_my_team_ids(), public.coach_team_create(text), public.coach_team_add(text, text), public.coach_team_remove(uuid),
  public.coach_join_team(), public.coach_copy_to_trainer(text, uuid, uuid) from public, anon;
grant execute on function public.coach_owner_of(uuid), public.coach_manages(uuid), public.coach_manages_text(text), public.coach_acting(), public.coach_acting_write(),
  public.coach_teammate(uuid), public.coach_teammate_text(text), public.coach_my_team_ids(), public.coach_team_create(text), public.coach_team_add(text, text), public.coach_team_remove(uuid),
  public.coach_join_team(), public.coach_copy_to_trainer(text, uuid, uuid) to authenticated;

alter table public.coach_teams enable row level security;
alter table public.coach_team_members enable row level security;
revoke all on public.coach_teams, public.coach_team_members from anon;
grant select, update on public.coach_teams to authenticated;
grant select on public.coach_team_members to authenticated;
grant update (display_name) on public.coach_team_members to authenticated;
-- Everyone on a team can see the team and its members; only the owner renames things
create policy coach_teams_read on public.coach_teams for select to authenticated
  using (id in (select public.coach_my_team_ids()));
create policy coach_teams_owner on public.coach_teams for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy coach_team_members_read on public.coach_team_members for select to authenticated
  using (team_id in (select public.coach_my_team_ids()));
create policy coach_team_members_owner on public.coach_team_members for update to authenticated
  using (team_id in (select id from public.coach_teams where owner_id = (select auth.uid())))
  with check (team_id in (select id from public.coach_teams where owner_id = (select auth.uid())));
