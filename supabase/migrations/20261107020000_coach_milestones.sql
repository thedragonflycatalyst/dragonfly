-- Milestones a client reaches (5th session, 4-week streak, first personal record). The app works them out when a
-- session is saved and records each once; later features use them to time a testimonial or referral ask.
-- Session summaries themselves are computed from coach_logs on the device, so nothing else is stored.

create table public.coach_milestones (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  key text not null check (key ~ '^(sessions:[0-9]{1,5}|streak:[0-9]{1,3}|first_pr)$'),
  log_id uuid references public.coach_logs(id) on delete set null,
  achieved_at timestamptz not null default now(),
  unique (client_id, key)
);
create index coach_milestones_trainer_idx on public.coach_milestones (trainer_id, achieved_at desc);

-- trainer_id always comes from the client record, never from the caller
create function public.coach_milestones_fill() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select c.trainer_id into new.trainer_id from public.coach_clients c where c.id = new.client_id;
  if new.trainer_id is null then raise exception 'no_such_client' using errcode = '42501'; end if;
  if new.log_id is not null and not exists (select 1 from public.coach_logs l where l.id = new.log_id and l.client_id = new.client_id) then
    raise exception 'log_not_for_client' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger coach_milestones_fill before insert on public.coach_milestones for each row execute function public.coach_milestones_fill();
revoke execute on function public.coach_milestones_fill() from public, anon, authenticated;

alter table public.coach_milestones enable row level security;
revoke all on public.coach_milestones from anon;
grant select, insert on public.coach_milestones to authenticated;
create policy coach_milestones_read on public.coach_milestones for select to authenticated
  using (public.coach_is_client(client_id) or public.coach_owns_client(client_id));
create policy coach_milestones_add on public.coach_milestones for insert to authenticated
  with check (public.coach_is_client(client_id) or public.coach_owns_client(client_id));
