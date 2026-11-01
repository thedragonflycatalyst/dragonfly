-- Dragonfly (coaching): the Clients tab.
-- Client profile fields, client pool (leads), groups, freezing (manual + automatic after inactivity),
-- dated notes, measurements, progress photos, files, forms with a built-in health questionnaire,
-- habits, goals and interests, and the client's own onboarding.

-- ---------------------------------------------------------------- trainer settings

alter table public.coach_trainers
  add column units text not null default 'imperial' check (units in ('imperial', 'metric')),
  add column auto_health_form boolean not null default true,    -- send the health questionnaire to new clients
  add column auto_freeze_days int not null default 90 check (auto_freeze_days between 14 and 730);

-- ---------------------------------------------------------------- client profile

-- No clients exist yet, so the name can be split into first/last cleanly
alter table public.coach_clients drop column name;
alter table public.coach_clients
  add column first_name text not null check (char_length(first_name) between 1 and 60),
  add column last_name text not null default '' check (char_length(last_name) <= 60),
  add column phone text check (char_length(phone) <= 30),
  add column sex text check (sex in ('male', 'female', 'other')),
  add column date_of_birth date check (date_of_birth between date '1900-01-01' and current_date),
  add column height_cm numeric(5,1) check (height_cm between 50 and 260),
  add column interests text[] not null default '{}',
  add column source text check (char_length(source) <= 80),          -- where a lead came from
  add column frozen_at timestamptz,
  add column frozen_reason text check (frozen_reason in ('manual', 'inactive')),
  add column last_session_at timestamptz,                              -- set by the session schedule import
  add column onboarded_at timestamptz,                                 -- client finished their onboarding
  add column updated_at timestamptz not null default now();
alter table public.coach_clients add column name text generated always as (trim(first_name || ' ' || last_name)) stored;

-- lead = in the client pool (not invited yet); frozen = no access, everything kept
alter table public.coach_clients drop constraint coach_clients_status_check;
alter table public.coach_clients add constraint coach_clients_status_check
  check (status in ('lead', 'invited', 'active', 'frozen', 'archived'));
create trigger coach_clients_touch before update on public.coach_clients for each row execute function public.coach_touch();

-- Status rules for trainer edits (coach_link_me is the only way to become 'active' from 'invited')
create or replace function public.coach_client_guard() returns trigger
language plpgsql set search_path = '' as
$$
begin
  if coalesce(current_setting('coach.linking', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.user_id := null;
      if new.status not in ('lead', 'invited') then new.status := 'invited'; end if;
      new.frozen_at := null; new.frozen_reason := null; new.onboarded_at := null; new.last_session_at := null;
    else
      new.user_id := old.user_id;
      new.onboarded_at := case when old.user_id = auth.uid() then new.onboarded_at else old.onboarded_at end;
      if old.user_id is not null and lower(new.email) <> lower(old.email) then
        raise exception 'this client is already linked to an account' using errcode = '42501';
      end if;
      if new.trainer_id <> old.trainer_id then raise exception 'a client cannot move between trainers' using errcode = '42501'; end if;
      -- Not linked yet: lead, invited or archived only. Linked: active, frozen or archived.
      if old.user_id is null and new.status in ('active', 'frozen') then new.status := old.status; end if;
      if old.user_id is not null and new.status in ('lead', 'invited') then new.status := old.status; end if;
    end if;
  end if;
  -- Freeze bookkeeping
  if new.status = 'frozen' and (tg_op = 'INSERT' or old.status <> 'frozen') then
    new.frozen_at := now(); new.frozen_reason := coalesce(new.frozen_reason, 'manual');
  elsif new.status <> 'frozen' then
    new.frozen_at := null; new.frozen_reason := null;
  end if;
  return new;
end
$$;

-- Access now requires an active (not frozen) client
create or replace function public.coach_is_client(cid uuid) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.coach_clients c where c.id = cid and c.user_id = auth.uid() and c.status = 'active') $$;

create or replace function public.coach_my_trainer_ids() returns setof uuid
language sql stable security definer set search_path = '' as
$$ select c.trainer_id from public.coach_clients c where c.user_id = auth.uid() and c.status = 'active' $$;

-- Only invited clients are linked on sign-in (never leads, frozen or archived records)
create or replace function public.coach_link_me() returns int
language plpgsql security definer set search_path = '' as
$$
declare v_email text; v_n int;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  perform set_config('coach.linking', 'on', true);
  update public.coach_clients c set user_id = auth.uid(), status = 'active', started_on = coalesce(c.started_on, current_date)
   where c.user_id is null and lower(c.email) = lower(v_email) and c.status = 'invited' and c.trainer_id <> auth.uid();
  get diagnostics v_n = row_count;
  perform set_config('coach.linking', '', true);
  return v_n;
end
$$;

-- Client edits their own profile (onboarding and later). Only these fields; returns nothing.
create function public.coach_update_my_profile(
  p_client uuid, p_phone text, p_sex text, p_date_of_birth date, p_height_cm numeric,
  p_goals text, p_interests text[], p_finish_onboarding boolean default false
) returns void
language plpgsql security definer set search_path = '' as
$$
begin
  if not public.coach_is_client(p_client) then raise exception 'not your record' using errcode = '42501'; end if;
  update public.coach_clients set
    phone = nullif(trim(p_phone), ''), sex = p_sex, date_of_birth = p_date_of_birth, height_cm = p_height_cm,
    goals = nullif(trim(p_goals), ''), interests = coalesce(p_interests, '{}'),
    onboarded_at = case when p_finish_onboarding then coalesce(onboarded_at, now()) else onboarded_at end
  where id = p_client;
end
$$;

-- Freeze active clients with no session for the trainer's chosen number of days (default 90).
-- Only clients whose sessions are tracked (last_session_at set) are considered. Runs daily.
create function public.coach_auto_freeze() returns int
language plpgsql security definer set search_path = '' as
$$
declare v_n int;
begin
  update public.coach_clients c set status = 'frozen', frozen_reason = 'inactive'
    from public.coach_trainers t
   where t.user_id = c.trainer_id and c.status = 'active' and c.last_session_at is not null
     and c.last_session_at < now() - make_interval(days => t.auto_freeze_days);
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- ---------------------------------------------------------------- groups

create table public.coach_groups (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (trainer_id, name)
);
create table public.coach_group_members (
  group_id uuid not null references public.coach_groups(id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, client_id)
);
create function public.coach_group_member_guard() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if not exists (select 1 from public.coach_groups g where g.id = new.group_id and g.trainer_id = new.trainer_id)
     or not exists (select 1 from public.coach_clients c where c.id = new.client_id and c.trainer_id = new.trainer_id) then
    raise exception 'group and client must both be this trainer''s' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger coach_group_members_guard before insert or update on public.coach_group_members
  for each row execute function public.coach_group_member_guard();

-- ---------------------------------------------------------------- notes (trainer only, dated, many per client)

drop table public.coach_client_notes;
create table public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_notes_client_idx on public.coach_notes (client_id, created_at desc);
create trigger coach_notes_guard before insert or update on public.coach_notes for each row execute function public.coach_child_guard();
create trigger coach_notes_touch before update on public.coach_notes for each row execute function public.coach_touch();

-- ---------------------------------------------------------------- measurements (also the weigh-in history)

create table public.coach_measurements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5,2) check (weight_kg between 20 and 400),
  body_fat_pct numeric(4,1) check (body_fat_pct between 2 and 75),
  neck_cm numeric(5,1) check (neck_cm between 10 and 100),
  chest_cm numeric(5,1) check (chest_cm between 30 and 250),
  waist_cm numeric(5,1) check (waist_cm between 30 and 250),
  hips_cm numeric(5,1) check (hips_cm between 30 and 250),
  arm_cm numeric(5,1) check (arm_cm between 10 and 100),
  thigh_cm numeric(5,1) check (thigh_cm between 20 and 150),
  calf_cm numeric(5,1) check (calf_cm between 10 and 100),
  note text check (char_length(note) <= 1000),
  entered_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (coalesce(weight_kg, body_fat_pct, neck_cm, chest_cm, waist_cm, hips_cm, arm_cm, thigh_cm, calf_cm) is not null)
);
create index coach_measurements_client_idx on public.coach_measurements (client_id, measured_on desc);
create trigger coach_measurements_guard before insert or update on public.coach_measurements for each row execute function public.coach_child_guard();

-- ---------------------------------------------------------------- progress photos and files (stored in the private coach bucket)
-- Storage path: {trainer_id}/{client_id}/{photos|files}/{random}.{ext}

create table public.coach_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  taken_on date not null default current_date,
  pose text not null default 'front' check (pose in ('front', 'side', 'back', 'other')),
  path text not null unique check (char_length(path) <= 300),
  note text check (char_length(note) <= 500),
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index coach_photos_client_idx on public.coach_photos (client_id, taken_on desc);
create trigger coach_photos_guard before insert or update on public.coach_photos for each row execute function public.coach_child_guard();

create table public.coach_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  path text not null unique check (char_length(path) <= 300),
  size_bytes bigint check (size_bytes between 0 and 26214400),
  mime text check (char_length(mime) <= 120),
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index coach_files_client_idx on public.coach_files (client_id, created_at desc);
create trigger coach_files_guard before insert or update on public.coach_files for each row execute function public.coach_child_guard();

-- The path's first two folders must be the client's trainer and the client
create function public.coach_path_matches() returns trigger
language plpgsql set search_path = '' as
$$
begin
  if split_part(new.path, '/', 1) <> new.trainer_id::text or split_part(new.path, '/', 2) <> new.client_id::text then
    raise exception 'file path does not match this client' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger coach_photos_path before insert or update on public.coach_photos for each row execute function public.coach_path_matches();
create trigger coach_files_path before insert or update on public.coach_files for each row execute function public.coach_path_matches();

-- Used by the storage bucket's policies: may the caller read/write this object path?
create function public.coach_storage_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as
$$
  select exists (
    select 1 from public.coach_clients c
     where c.id::text = split_part(p_name, '/', 2) and c.trainer_id::text = split_part(p_name, '/', 1)
       and split_part(p_name, '/', 3) in ('photos', 'files')
       and (c.trainer_id = auth.uid() or (c.user_id = auth.uid() and c.status = 'active')))
$$;

-- ---------------------------------------------------------------- forms (including the built-in health questionnaire)
-- questions = [{ id, type: 'yesno'|'text'|'longtext'|'number'|'date'|'choice'|'scale'|'signature', label, required, options? }]

create table public.coach_forms (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  kind text not null default 'custom' check (kind in ('custom', 'health')),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  questions jsonb not null default '[]' check (jsonb_typeof(questions) = 'array'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index coach_forms_one_health on public.coach_forms (trainer_id) where kind = 'health';
create trigger coach_forms_touch before update on public.coach_forms for each row execute function public.coach_touch();

-- A form sent to a client. The questions are copied in so editing the form later doesn't change answered ones.
create table public.coach_form_requests (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references public.coach_forms(id) on delete set null,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  kind text not null default 'custom' check (kind in ('custom', 'health')),
  title text not null,
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  flagged boolean not null default false,       -- health questionnaire: answered yes to something
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
create index coach_form_requests_client_idx on public.coach_form_requests (client_id, requested_at desc);
create trigger coach_form_requests_guard before insert or update on public.coach_form_requests for each row execute function public.coach_child_guard();

-- The health questionnaire every trainer starts with (Dragonfly's own wording)
create function public.coach_health_questions() returns jsonb
language sql immutable set search_path = '' as
$$ select jsonb_build_array(
  jsonb_build_object('id', 'heart', 'type', 'yesno', 'required', true, 'label', 'Has a doctor ever told you that you have a heart condition or high blood pressure?'),
  jsonb_build_object('id', 'chest', 'type', 'yesno', 'required', true, 'label', 'Do you get chest pain at rest, during everyday activities, or when you exercise?'),
  jsonb_build_object('id', 'dizzy', 'type', 'yesno', 'required', true, 'label', 'In the past year, have you lost your balance from dizziness or lost consciousness?'),
  jsonb_build_object('id', 'chronic', 'type', 'yesno', 'required', true, 'label', 'Have you been diagnosed with any other ongoing medical condition?'),
  jsonb_build_object('id', 'meds', 'type', 'yesno', 'required', true, 'label', 'Do you take prescribed medication for an ongoing medical condition?'),
  jsonb_build_object('id', 'joints', 'type', 'yesno', 'required', true, 'label', 'Do you have a bone, joint or muscle problem that more activity could make worse?'),
  jsonb_build_object('id', 'supervised', 'type', 'yesno', 'required', true, 'label', 'Has a doctor ever said you should only exercise under medical supervision?'),
  jsonb_build_object('id', 'pregnancy', 'type', 'yesno', 'required', true, 'label', 'Are you pregnant, or have you given birth in the past 6 months?'),
  jsonb_build_object('id', 'details', 'type', 'longtext', 'required', false, 'label', 'If you answered yes to anything, tell your trainer more here.'),
  jsonb_build_object('id', 'injuries', 'type', 'longtext', 'required', false, 'label', 'Any past injuries, surgeries or limitations your trainer should know about?'),
  jsonb_build_object('id', 'signature', 'type', 'signature', 'required', true, 'label', 'Type your full name to confirm your answers are true to the best of your knowledge.')
) $$;

-- New trainers get the health questionnaire; new clients get it sent automatically (trainer setting)
create function public.coach_seed_trainer() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  insert into public.coach_forms (trainer_id, kind, title, description, questions)
  values (new.user_id, 'health', 'Health questionnaire',
          'A quick check before you start training. If you answer yes to anything, check with your doctor before becoming much more active.',
          public.coach_health_questions())
  on conflict do nothing;
  return new;
end
$$;
create trigger coach_trainers_seed after insert on public.coach_trainers for each row execute function public.coach_seed_trainer();
insert into public.coach_forms (trainer_id, kind, title, description, questions)
  select t.user_id, 'health', 'Health questionnaire',
         'A quick check before you start training. If you answer yes to anything, check with your doctor before becoming much more active.',
         public.coach_health_questions()
    from public.coach_trainers t
  on conflict do nothing;

create function public.coach_send_health_form() returns trigger
language plpgsql security definer set search_path = '' as
$$
declare f public.coach_forms%rowtype;
begin
  if new.status <> 'invited' then return new; end if;
  select fm.* into f from public.coach_forms fm join public.coach_trainers t on t.user_id = fm.trainer_id
   where fm.trainer_id = new.trainer_id and fm.kind = 'health' and not fm.archived and t.auto_health_form;
  if found and not exists (select 1 from public.coach_form_requests r where r.client_id = new.id and r.kind = 'health') then
    insert into public.coach_form_requests (form_id, client_id, trainer_id, kind, title, questions)
    values (f.id, new.id, new.trainer_id, 'health', f.title, f.questions);
  end if;
  return new;
end
$$;
create trigger coach_clients_health_form after insert or update of status on public.coach_clients
  for each row execute function public.coach_send_health_form();

-- Client submits a form. Checks required answers; flags any "yes" on the health questionnaire.
create function public.coach_submit_form(p_request uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = '' as
$$
declare r public.coach_form_requests%rowtype; q jsonb; v_flag boolean := false;
begin
  select * into r from public.coach_form_requests where id = p_request for update;
  if not found or not public.coach_is_client(r.client_id) then raise exception 'not your form' using errcode = '42501'; end if;
  if r.status = 'completed' then raise exception 'form_already_submitted' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'bad answers' using errcode = '22023'; end if;
  for q in select * from jsonb_array_elements(r.questions) loop
    if coalesce((q->>'required')::boolean, false) and coalesce(trim(p_answers->>(q->>'id')), '') = '' then
      raise exception 'form_incomplete' using errcode = 'P0001';
    end if;
    if r.kind = 'health' and q->>'type' = 'yesno' and p_answers->>(q->>'id') = 'yes' then v_flag := true; end if;
  end loop;
  update public.coach_form_requests set answers = p_answers, status = 'completed', completed_at = now(), flagged = v_flag
   where id = p_request;
end
$$;

-- ---------------------------------------------------------------- habits

create table public.coach_habits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  details text check (char_length(details) <= 1000),
  days_per_week smallint not null default 7 check (days_per_week between 1 and 7),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index coach_habits_client_idx on public.coach_habits (client_id) where active;
create trigger coach_habits_guard before insert or update on public.coach_habits for each row execute function public.coach_child_guard();

create table public.coach_habit_checks (
  habit_id uuid not null references public.coach_habits(id) on delete cascade,
  day date not null check (day <= current_date + 1),
  checked_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (habit_id, day)
);

create function public.coach_habit_client(hid uuid) returns uuid
language sql stable security definer set search_path = '' as
$$ select client_id from public.coach_habits where id = hid $$;

-- ---------------------------------------------------------------- privileges

revoke execute on function public.coach_update_my_profile(uuid, text, text, date, numeric, text, text[], boolean),
  public.coach_submit_form(uuid, jsonb), public.coach_storage_ok(text), public.coach_habit_client(uuid) from public, anon;
grant execute on function public.coach_update_my_profile(uuid, text, text, date, numeric, text, text[], boolean),
  public.coach_submit_form(uuid, jsonb), public.coach_storage_ok(text), public.coach_habit_client(uuid) to authenticated;
revoke execute on function public.coach_auto_freeze(), public.coach_group_member_guard(), public.coach_path_matches(),
  public.coach_seed_trainer(), public.coach_send_health_form() from public, anon, authenticated;

alter table public.coach_groups enable row level security;
alter table public.coach_group_members enable row level security;
alter table public.coach_notes enable row level security;
alter table public.coach_measurements enable row level security;
alter table public.coach_photos enable row level security;
alter table public.coach_files enable row level security;
alter table public.coach_forms enable row level security;
alter table public.coach_form_requests enable row level security;
alter table public.coach_habits enable row level security;
alter table public.coach_habit_checks enable row level security;

revoke all on public.coach_groups, public.coach_group_members, public.coach_notes, public.coach_measurements, public.coach_photos,
  public.coach_files, public.coach_forms, public.coach_form_requests, public.coach_habits, public.coach_habit_checks from anon;
grant select, insert, update, delete on public.coach_groups, public.coach_group_members, public.coach_notes, public.coach_measurements,
  public.coach_photos, public.coach_files, public.coach_forms, public.coach_form_requests, public.coach_habits, public.coach_habit_checks to authenticated;

-- Trainer-only tables
create policy coach_groups_trainer on public.coach_groups for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_group_members_trainer on public.coach_group_members for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_notes_trainer on public.coach_notes for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_forms_trainer on public.coach_forms for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));

-- Shared with the client: the trainer manages everything; the client reads theirs and adds/edits/removes their own entries
create policy coach_measurements_trainer on public.coach_measurements for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_measurements_client_read on public.coach_measurements for select to authenticated using (public.coach_is_client(client_id));
create policy coach_measurements_client_write on public.coach_measurements for insert to authenticated
  with check (public.coach_is_client(client_id) and entered_by = (select auth.uid()));
create policy coach_measurements_client_edit on public.coach_measurements for update to authenticated
  using (public.coach_is_client(client_id) and entered_by = (select auth.uid())) with check (entered_by = (select auth.uid()));
create policy coach_measurements_client_delete on public.coach_measurements for delete to authenticated
  using (public.coach_is_client(client_id) and entered_by = (select auth.uid()));

create policy coach_photos_trainer on public.coach_photos for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_photos_client_read on public.coach_photos for select to authenticated using (public.coach_is_client(client_id));
create policy coach_photos_client_write on public.coach_photos for insert to authenticated
  with check (public.coach_is_client(client_id) and uploaded_by = (select auth.uid()));
create policy coach_photos_client_delete on public.coach_photos for delete to authenticated
  using (public.coach_is_client(client_id) and uploaded_by = (select auth.uid()));

create policy coach_files_trainer on public.coach_files for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_files_client_read on public.coach_files for select to authenticated using (public.coach_is_client(client_id));
create policy coach_files_client_write on public.coach_files for insert to authenticated
  with check (public.coach_is_client(client_id) and uploaded_by = (select auth.uid()));
create policy coach_files_client_delete on public.coach_files for delete to authenticated
  using (public.coach_is_client(client_id) and uploaded_by = (select auth.uid()));

-- Form requests: trainer manages; client reads theirs and submits through coach_submit_form
create policy coach_form_requests_trainer on public.coach_form_requests for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_form_requests_client_read on public.coach_form_requests for select to authenticated using (public.coach_is_client(client_id));

-- Habits: trainer manages; client reads and ticks off days
create policy coach_habits_trainer on public.coach_habits for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
create policy coach_habits_client_read on public.coach_habits for select to authenticated using (public.coach_is_client(client_id));
create policy coach_habit_checks_read on public.coach_habit_checks for select to authenticated
  using (public.coach_is_client(public.coach_habit_client(habit_id)) or public.coach_owns_client(public.coach_habit_client(habit_id)));
create policy coach_habit_checks_client_write on public.coach_habit_checks for insert to authenticated
  with check (public.coach_is_client(public.coach_habit_client(habit_id)) and checked_by = (select auth.uid()));
create policy coach_habit_checks_client_delete on public.coach_habit_checks for delete to authenticated
  using (public.coach_is_client(public.coach_habit_client(habit_id)));
