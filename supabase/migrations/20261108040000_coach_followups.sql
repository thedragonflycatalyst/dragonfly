-- Follow-ups that stay until the trainer says they're done (owner 2026-11-07): when a session moves, the trainer has to
-- make the same change in ClubAutomation ("if we forget to put the change in club auto we're cooked"). Created for
-- trainers who have a ClubAutomation calendar linked. A phone alert goes out at once and repeats every hour (8 AM–9 PM,
-- the trainer's time) until it's marked done; the app shows a red bar on every screen until then.
create table public.coach_followups (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  client_id uuid references public.coach_clients(id) on delete set null,
  booking_id uuid references public.coach_bookings(id) on delete set null,
  kind text not null default 'clubautomation_move' check (kind in ('clubautomation_move')),
  title text not null check (char_length(title) between 1 and 300),
  old_start timestamptz,
  new_start timestamptz,
  status text not null default 'open' check (status in ('open', 'done')),
  alerts int not null default 0,
  last_alert_at timestamptz,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index coach_followups_open_idx on public.coach_followups (trainer_id, status, created_at);
alter table public.coach_followups enable row level security;
revoke all on public.coach_followups from anon;
grant select on public.coach_followups to authenticated;
create policy coach_followups_own on public.coach_followups for select to authenticated using (trainer_id = (select auth.uid()));

create function public.coach_followup_move(p_trainer uuid, p_client uuid, p_booking uuid, p_old timestamptz, p_new timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare tz text; nm text; f text := 'Dy, Mon FMDD FMHH12:MI AM';
begin
  if not exists (select 1 from public.coach_calendar_feeds where trainer_id = p_trainer and source = 'clubautomation') then return; end if;
  select coalesce(timezone, 'America/New_York') into tz from public.coach_trainers where user_id = p_trainer;
  select name into nm from public.coach_clients where id = p_client;
  insert into public.coach_followups (trainer_id, client_id, booking_id, title, old_start, new_start)
  values (p_trainer, p_client, p_booking,
          'Reschedule ' || coalesce(nm, 'client') || ' in ClubAutomation from ' || to_char(p_old at time zone tz, f) || ' to ' || to_char(p_new at time zone tz, f),
          p_old, p_new);
end $$;
revoke execute on function public.coach_followup_move(uuid, uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;

create function public.coach_followup_done(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.coach_followups set status = 'done', done_at = now() where id = p_id and trainer_id = auth.uid() and status = 'open';
  if not found then raise exception 'not_open' using errcode = '22023'; end if;
end $$;
revoke execute on function public.coach_followup_done(uuid) from public, anon;
grant execute on function public.coach_followup_done(uuid) to authenticated;

-- Phone alert right away (repeats come from coach-outbox every 15 minutes, at most hourly)
create function public.coach_followup_push() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.coach_push_tokens where user_id = new.trainer_id) then
    perform net.http_post(
      url := 'https://fkksaivdznqbfsfsagsj.supabase.co/functions/v1/coach-push',
      headers := jsonb_build_object('content-type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cron_secret')),
      body := jsonb_build_object('action', 'followup', 'followup_id', new.id),
      timeout_milliseconds := 10000);
  end if;
  return null;
end $$;
create trigger coach_followup_push after insert on public.coach_followups for each row execute function public.coach_followup_push();
revoke execute on function public.coach_followup_push() from public, anon, authenticated;
