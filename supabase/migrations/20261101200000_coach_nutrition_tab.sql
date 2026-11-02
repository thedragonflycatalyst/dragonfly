-- Dragonfly (coaching): the Nutrition tab.
-- Meal plans with macro targets, the trainer's own foods, folders, and which clients each plan is shared with.
-- Plan shape (meals, targets): see app/src/lib/nutrition.ts. Foods are copied into the plan, so editing a
-- custom food later doesn't change plans already written.

create table public.coach_nutrition_folders (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (trainer_id, name)
);

create table public.coach_foods (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  brand text check (char_length(brand) <= 80),
  serving_label text not null default '1 serving' check (char_length(serving_label) between 1 and 60),
  serving_g numeric check (serving_g > 0 and serving_g <= 5000),
  kcal numeric not null default 0 check (kcal between 0 and 10000),
  protein numeric not null default 0 check (protein between 0 and 1000),
  carbs numeric not null default 0 check (carbs between 0 and 1000),
  fat numeric not null default 0 check (fat between 0 and 1000),
  sugar numeric not null default 0 check (sugar between 0 and 1000),
  fibre numeric not null default 0 check (fibre between 0 and 1000),
  sodium numeric not null default 0 check (sodium between 0 and 100000),   -- mg
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_foods_trainer_idx on public.coach_foods (trainer_id);

create table public.coach_nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 4000),
  notes text check (char_length(notes) <= 8000),
  cover text check (char_length(cover) <= 300),
  folder_id uuid references public.coach_nutrition_folders(id) on delete set null,
  targets jsonb not null default '{"on": false, "mode": "g"}' check (jsonb_typeof(targets) = 'object'),
  meals jsonb not null default '[]' check (jsonb_typeof(meals) = 'array' and pg_column_size(meals) < 600000),
  archived boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_nutrition_plans_trainer_idx on public.coach_nutrition_plans (trainer_id);

-- Which clients a plan is shared with (a client can have more than one plan)
create table public.coach_nutrition_plan_clients (
  plan_id uuid not null references public.coach_nutrition_plans(id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (plan_id, client_id)
);
create index coach_nutrition_plan_clients_client_idx on public.coach_nutrition_plan_clients (client_id);

create trigger coach_foods_touch before update on public.coach_foods for each row execute function public.coach_touch();
create trigger coach_nutrition_plans_touch before update on public.coach_nutrition_plans for each row execute function public.coach_touch();

-- A plan's folder must be the same trainer's
create function public.coach_nutrition_folder_guard() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if new.folder_id is not null and not exists (
      select 1 from public.coach_nutrition_folders f where f.id = new.folder_id and f.trainer_id = new.trainer_id) then
    raise exception 'folder does not belong to this trainer' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger coach_nutrition_plans_folder_guard before insert or update on public.coach_nutrition_plans
  for each row execute function public.coach_nutrition_folder_guard();

-- Sharing: the plan and the client must both be this trainer's. Marks the plan recently used.
create function public.coach_nutrition_share_guard() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if not exists (select 1 from public.coach_nutrition_plans p where p.id = new.plan_id and p.trainer_id = new.trainer_id)
     or not exists (select 1 from public.coach_clients c where c.id = new.client_id and c.trainer_id = new.trainer_id) then
    raise exception 'plan or client does not belong to this trainer' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    update public.coach_nutrition_plans set last_used_at = now() where id = new.plan_id;
  end if;
  return new;
end
$$;
create trigger coach_nutrition_plan_clients_guard before insert or update on public.coach_nutrition_plan_clients
  for each row execute function public.coach_nutrition_share_guard();

-- Can the signed-in client see this plan? (security definer so the plans policy doesn't recurse)
create function public.coach_nutrition_plan_mine(p_plan uuid) returns boolean
language sql stable security definer set search_path = '' as
$$
  select exists (select 1 from public.coach_nutrition_plan_clients pc where pc.plan_id = p_plan and public.coach_is_client(pc.client_id))
$$;

revoke execute on function public.coach_nutrition_folder_guard(), public.coach_nutrition_share_guard() from public, anon, authenticated;
revoke execute on function public.coach_nutrition_plan_mine(uuid) from public, anon;
grant execute on function public.coach_nutrition_plan_mine(uuid) to authenticated;

alter table public.coach_nutrition_folders enable row level security;
alter table public.coach_foods enable row level security;
alter table public.coach_nutrition_plans enable row level security;
alter table public.coach_nutrition_plan_clients enable row level security;
revoke all on public.coach_nutrition_folders, public.coach_foods, public.coach_nutrition_plans, public.coach_nutrition_plan_clients from anon;
grant select, insert, update, delete on public.coach_nutrition_folders, public.coach_foods, public.coach_nutrition_plans, public.coach_nutrition_plan_clients to authenticated;

create policy coach_nutrition_folders_trainer on public.coach_nutrition_folders for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_foods_trainer on public.coach_foods for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_nutrition_plans_trainer on public.coach_nutrition_plans for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_nutrition_plans_client on public.coach_nutrition_plans for select to authenticated
  using (public.coach_nutrition_plan_mine(id));
create policy coach_nutrition_plan_clients_trainer on public.coach_nutrition_plan_clients for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_nutrition_plan_clients_client on public.coach_nutrition_plan_clients for select to authenticated
  using (public.coach_is_client(client_id));

-- ---------------------------------------------------------------- cover art
-- Covers can be a preset ('preset:3') or the trainer's own image in coach-media: {trainer_id}/covers/{file}
alter table public.coach_programs add column cover text check (char_length(cover) <= 300);
create or replace function public.coach_media_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as
$$
  select split_part(p_name, '/', 2) in ('exercises', 'covers') and (
    split_part(p_name, '/', 1) = auth.uid()::text
    or exists (select 1 from public.coach_clients c
                where c.trainer_id::text = split_part(p_name, '/', 1) and c.user_id = auth.uid() and c.status = 'active'))
$$;
-- Meal photos join progress photos and files in the private client folder
create or replace function public.coach_storage_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as
$$
  select exists (
    select 1 from public.coach_clients c
     where c.id::text = split_part(p_name, '/', 2) and c.trainer_id::text = split_part(p_name, '/', 1)
       and split_part(p_name, '/', 3) in ('photos', 'files', 'meals')
       and (c.trainer_id = auth.uid() or (c.user_id = auth.uid() and c.status = 'active')))
$$;

-- ---------------------------------------------------------------- food diary
-- One row per food eaten. n = nutrients for the amount eaten (kcal, protein, carbs, fat, sugar, fibre, sodium),
-- stored so daily totals don't depend on the food database.
create table public.coach_food_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  eaten_on date not null,
  meal text not null check (char_length(meal) between 1 and 60),
  name text not null check (char_length(name) between 1 and 200),
  food jsonb check (food is null or jsonb_typeof(food) = 'object'),
  qty numeric check (qty > 0 and qty <= 100000),
  portion text check (char_length(portion) <= 80),
  n jsonb not null check (jsonb_typeof(n) = 'object'),
  source text not null check (source in ('search', 'plan', 'barcode', 'quick', 'photo', 'ai', 'saved')),
  photo_path text check (char_length(photo_path) <= 300),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index coach_food_logs_client_day_idx on public.coach_food_logs (client_id, eaten_on);

create table public.coach_water_logs (
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  day date not null,
  ml int not null default 0 check (ml between 0 and 20000),
  updated_at timestamptz not null default now(),
  primary key (client_id, day)
);

-- A client's own saved meals, to log again in one tap
create table public.coach_saved_meals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  items jsonb not null check (jsonb_typeof(items) = 'array' and pg_column_size(items) < 200000),
  created_at timestamptz not null default now()
);
create index coach_saved_meals_client_idx on public.coach_saved_meals (client_id);

-- Client-side rows take the client's trainer automatically, so nobody can file them under someone else
create function public.coach_fill_trainer() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  select c.trainer_id into new.trainer_id from public.coach_clients c where c.id = new.client_id;
  if new.trainer_id is null then raise exception 'unknown client' using errcode = '42501'; end if;
  return new;
end
$$;
create trigger coach_food_logs_fill before insert or update on public.coach_food_logs for each row execute function public.coach_fill_trainer();
create trigger coach_water_logs_fill before insert or update on public.coach_water_logs for each row execute function public.coach_fill_trainer();
create trigger coach_saved_meals_fill before insert or update on public.coach_saved_meals for each row execute function public.coach_fill_trainer();

-- AI photo estimates: one row per call, so the edge function can cap use per person per day
create table public.coach_ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  at timestamptz not null default now()
);
create index coach_ai_calls_user_idx on public.coach_ai_calls (user_id, at);

revoke execute on function public.coach_fill_trainer() from public, anon, authenticated;

alter table public.coach_food_logs enable row level security;
alter table public.coach_water_logs enable row level security;
alter table public.coach_saved_meals enable row level security;
alter table public.coach_ai_calls enable row level security;   -- no policies: only the edge function (service role) uses it
revoke all on public.coach_food_logs, public.coach_water_logs, public.coach_saved_meals, public.coach_ai_calls from anon;
revoke all on public.coach_ai_calls from authenticated;
grant select, insert, update, delete on public.coach_water_logs, public.coach_saved_meals to authenticated;
-- Diary edits can change what was eaten, never who logged it or whose diary it's in
grant select, insert, delete on public.coach_food_logs to authenticated;
grant update (eaten_on, meal, name, food, qty, portion, n, photo_path, note) on public.coach_food_logs to authenticated;

-- The client keeps their own diary; their trainer can read it and fix entries when coaching
create policy coach_food_logs_read on public.coach_food_logs for select to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id));
create policy coach_food_logs_add on public.coach_food_logs for insert to authenticated
  with check ((public.coach_is_client(client_id) or public.coach_owns_client(client_id)) and user_id = (select auth.uid()));
create policy coach_food_logs_change on public.coach_food_logs for update to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id))
  with check (public.coach_is_client(client_id) or public.coach_owns_client(client_id));
create policy coach_food_logs_remove on public.coach_food_logs for delete to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id));
create policy coach_water_logs_rw on public.coach_water_logs for all to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id))
  with check (public.coach_is_client(client_id) or public.coach_owns_client(client_id));
create policy coach_saved_meals_client on public.coach_saved_meals for all to authenticated
  using (public.coach_is_client(client_id)) with check (public.coach_is_client(client_id));
create policy coach_saved_meals_trainer on public.coach_saved_meals for select to authenticated
  using (public.coach_owns_client(client_id));
