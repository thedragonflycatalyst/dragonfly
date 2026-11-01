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
