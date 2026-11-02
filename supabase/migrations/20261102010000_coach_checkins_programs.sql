-- Dragonfly (coaching): personal check-ins and richer programs.
--
-- Check-ins are the trainer reaching out personally (text, call, in person, message), not a form the client fills in.
-- Each client gets a rhythm (every N days, from the trainer's default unless set); the app works out who is due
-- or overdue from the last check-in. AI only prepares talking points (coach-checkin-brief edge function).
--
-- Programs can now hold more than workouts on a day: tasks like "update measurements" or "upload a progress
-- photo", and notes. Assigning a program turns tasks into coach_tasks on the client's calendar.

-- Programs: suggested times of day for their sessions and tasks (shown to clients, used for reminders)
alter table public.coach_programs
  add column am_time time not null default '07:00',
  add column pm_time time not null default '19:00';

alter table public.coach_trainers add column checkin_every_days int not null default 14 check (checkin_every_days between 1 and 90);

create table public.coach_checkin_plans (
  client_id uuid primary key references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  every_days int not null default 14 check (every_days between 1 and 90),
  channel text not null default 'text' check (channel in ('text', 'call', 'in_person', 'message', 'email', 'video')),
  paused boolean not null default false,
  notes text check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now()
);

create table public.coach_checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  done_on date not null default current_date,
  channel text not null default 'text' check (channel in ('text', 'call', 'in_person', 'message', 'email', 'video')),
  note text check (char_length(note) <= 4000),
  mood smallint check (mood between 1 and 5),          -- how the client seemed: 1 struggling … 5 thriving
  follow_up_on date,                                    -- overrides the rhythm for the next one
  created_at timestamptz not null default now()
);
create index coach_checkins_client_idx on public.coach_checkins (client_id, done_on desc);

create table public.coach_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  program_id uuid references public.coach_programs(id) on delete set null,
  due_on date not null,
  kind text not null check (kind in ('measurements', 'photo', 'note')),
  title text not null check (char_length(title) between 1 and 200),
  details text check (char_length(details) <= 2000),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index coach_tasks_client_day_idx on public.coach_tasks (client_id, due_on);

create trigger coach_checkin_plans_fill before insert or update on public.coach_checkin_plans for each row execute function public.coach_fill_trainer();
create trigger coach_checkins_fill before insert or update on public.coach_checkins for each row execute function public.coach_fill_trainer();
create trigger coach_tasks_fill before insert or update on public.coach_tasks for each row execute function public.coach_fill_trainer();

-- Adding measurements or a progress photo ticks off the matching tasks that are due
create function public.coach_tasks_autodone() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  update public.coach_tasks set done_at = now()
   where client_id = new.client_id and done_at is null and due_on <= current_date + 1
     and kind = case tg_table_name when 'coach_measurements' then 'measurements' else 'photo' end;
  return new;
end
$$;
create trigger coach_measurements_tasks after insert on public.coach_measurements for each row execute function public.coach_tasks_autodone();
create trigger coach_photos_tasks after insert on public.coach_photos for each row execute function public.coach_tasks_autodone();

-- Client ticks off (or un-ticks) one of their tasks
create function public.coach_task_done(p_task uuid, p_done boolean) returns void
language plpgsql security definer set search_path = '' as
$$
begin
  update public.coach_tasks t set done_at = case when p_done then now() else null end
   where t.id = p_task and public.coach_is_client(t.client_id);
  if not found then raise exception 'not your task' using errcode = '42501'; end if;
end
$$;

-- Program schedule items: { week, day, kind: 'workout'|'measurements'|'photo'|'note', workout_id?, title?, details? }
-- (items without kind are workouts, as before). Assigning creates workouts and tasks from the start date.
create or replace function public.coach_assign_program(p_program uuid, p_client uuid, p_start date) returns int
language plpgsql security definer set search_path = '' as
$$
declare v_prog public.coach_programs%rowtype; v_n int := 0; s jsonb; w public.coach_workouts%rowtype;
        me uuid := public.coach_acting_write(); v_day date; v_kind text;
begin
  select * into v_prog from public.coach_programs where id = p_program and trainer_id = me;
  if me is null or not found or not public.coach_owns_client(p_client) then
    raise exception 'not your program or client' using errcode = '42501';
  end if;
  for s in select * from jsonb_array_elements(v_prog.schedule) loop
    v_day := p_start + ((s->>'week')::int - 1) * 7 + ((s->>'day')::int - 1);
    v_kind := coalesce(s->>'kind', 'workout');
    if v_kind = 'workout' then
      select * into w from public.coach_workouts where id = (s->>'workout_id')::uuid and trainer_id = me;
      continue when not found;
      insert into public.coach_assignments (trainer_id, client_id, workout_id, program_id, scheduled_on, title, snapshot)
      values (me, p_client, w.id, v_prog.id, v_day, w.name, w.blocks);
    elsif v_kind in ('measurements', 'photo', 'note') then
      insert into public.coach_tasks (client_id, trainer_id, program_id, due_on, kind, title, details)
      values (p_client, me, v_prog.id, v_day, v_kind,
              coalesce(nullif(left(s->>'title', 200), ''), case v_kind when 'measurements' then 'Update your measurements' when 'photo' then 'Upload a progress photo' else 'Note from your trainer' end),
              nullif(left(s->>'details', 2000), ''));
    else
      continue;
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end
$$;

revoke execute on function public.coach_tasks_autodone() from public, anon, authenticated;
revoke execute on function public.coach_task_done(uuid, boolean) from public, anon;
grant execute on function public.coach_task_done(uuid, boolean) to authenticated;

alter table public.coach_checkin_plans enable row level security;
alter table public.coach_checkins enable row level security;
alter table public.coach_tasks enable row level security;
revoke all on public.coach_checkin_plans, public.coach_checkins, public.coach_tasks from anon;
grant select, insert, update, delete on public.coach_checkin_plans, public.coach_checkins, public.coach_tasks to authenticated;

-- Check-ins are the trainer's own notes: clients don't see them
create policy coach_checkin_plans_trainer on public.coach_checkin_plans for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_checkins_trainer on public.coach_checkins for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_tasks_trainer on public.coach_tasks for all to authenticated
  using (trainer_id = (select public.coach_acting())) with check (trainer_id = (select public.coach_acting_write()));
create policy coach_tasks_client_read on public.coach_tasks for select to authenticated using (public.coach_is_client(client_id));
