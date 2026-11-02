-- Dragonfly (coaching): the Scale tab. Weigh-ins with optional body-composition readings from smart scales
-- (bio-impedance: body fat, muscle, water, visceral fat, segmental readings…). They belong to the person, not to a
-- trainer, so trainers and clients both have one; a trainer can read their active clients' weigh-ins.

create table public.coach_weighins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(6,2) not null check (weight_kg between 20 and 400),
  metrics jsonb not null default '{}'::jsonb,
  source text not null default 'manual' check (source in ('manual', 'import', 'health_connect')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, measured_at)
);
create index coach_weighins_user_idx on public.coach_weighins (user_id, measured_at desc);

-- Only known readings, each a number in a sensible range
create function public.coach_metrics_ok(m jsonb) returns boolean
language sql immutable set search_path = '' as
$$
  select jsonb_typeof(m) = 'object' and not exists (
    select 1 from jsonb_each(m) e
     where e.key not in ('body_fat_pct', 'muscle_pct', 'body_water_pct', 'visceral_fat', 'subcutaneous_fat_pct', 'skeletal_muscle_pct',
                         'bone_mass_kg', 'protein_pct', 'bmr_kcal', 'metabolic_age', 'heart_rate', 'fat_arm_l', 'fat_arm_r', 'fat_leg_l',
                         'fat_leg_r', 'fat_trunk', 'muscle_arm_l', 'muscle_arm_r', 'muscle_leg_l', 'muscle_leg_r', 'muscle_trunk')
        or jsonb_typeof(e.value) <> 'number' or (e.value)::numeric < 0 or (e.value)::numeric > 10000)
$$;
alter table public.coach_weighins add constraint coach_weighins_metrics_ok check (public.coach_metrics_ok(metrics));

create table public.coach_scale_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  metrics text[] not null default '{weight,body_fat_pct,muscle_pct,lean_mass}' check (cardinality(metrics) <= 40),
  goal_kg numeric(6,2) check (goal_kg between 20 and 400),
  goal_date date,
  height_cm numeric(5,1) check (height_cm between 80 and 260),
  sex text check (sex in ('male', 'female', 'other')),
  reminder_on boolean not null default false,
  reminder_time time not null default '07:30',
  updated_at timestamptz not null default now()
);

-- A trainer (or owner viewing them) can read the weigh-ins of their active and frozen clients
create function public.coach_trains_user(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.coach_clients c where c.user_id = p_user and c.trainer_id = public.coach_acting() and c.status in ('active', 'frozen')) $$;

revoke execute on function public.coach_trains_user(uuid) from public, anon;
grant execute on function public.coach_trains_user(uuid) to authenticated;

alter table public.coach_weighins enable row level security;
alter table public.coach_scale_settings enable row level security;
revoke all on public.coach_weighins, public.coach_scale_settings from anon;
grant select, insert, update, delete on public.coach_weighins, public.coach_scale_settings to authenticated;

create policy coach_weighins_own on public.coach_weighins for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy coach_weighins_trainer on public.coach_weighins for select to authenticated using (public.coach_trains_user(user_id));
create policy coach_scale_settings_own on public.coach_scale_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy coach_scale_settings_trainer on public.coach_scale_settings for select to authenticated using (public.coach_trains_user(user_id));
