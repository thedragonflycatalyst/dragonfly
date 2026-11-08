-- Several linked calendars per trainer (owner, Nov 6, 2026: ClubAutomation + three Outlook calendars).
-- Each feed refreshes on its own every 5 minutes; a feed that fails keeps its last good busy times instead of
-- emptying (so a hiccup at Outlook never opens the owner's real meetings up for booking).
-- Feed links are private (anyone with one can read that calendar): only the trainer can see or change theirs.

create table if not exists public.coach_calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.coach_trainers(user_id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  source text not null default 'other' check (source in ('clubautomation', 'outlook', 'google', 'apple', 'other')),
  url text not null check (url ~ '^(https|webcal)://' and char_length(url) <= 1000),
  synced_at timestamptz,
  error text check (char_length(error) <= 100),
  events int,
  created_at timestamptz not null default now(),
  unique (trainer_id, url)
);
alter table public.coach_calendar_feeds enable row level security;
drop policy if exists coach_calendar_feeds_own on public.coach_calendar_feeds;
create policy coach_calendar_feeds_own on public.coach_calendar_feeds for all
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));

alter table public.coach_external_busy add column if not exists feed_id uuid references public.coach_calendar_feeds(id) on delete cascade;
create index if not exists coach_external_busy_feed on public.coach_external_busy (feed_id);

-- The single link set in the Coach app's Connections screen becomes a feed too.
insert into public.coach_calendar_feeds (trainer_id, label, source, url)
select d.user_id,
       case when d.busy_ics_url ~* 'clubautomation\.com' then 'ClubAutomation' when d.busy_ics_url ~* 'outlook\.' then 'Outlook' else 'Linked calendar' end,
       case when d.busy_ics_url ~* 'clubautomation\.com' then 'clubautomation' when d.busy_ics_url ~* 'outlook\.' then 'outlook'
            when d.busy_ics_url ~* 'google\.com' then 'google' when d.busy_ics_url ~* 'icloud\.com' then 'apple' else 'other' end,
       d.busy_ics_url
  from public.coach_trainer_details d where d.busy_ics_url is not null
on conflict (trainer_id, url) do nothing;
update public.coach_external_busy x set feed_id = f.id
  from public.coach_calendar_feeds f where f.trainer_id = x.trainer_id and x.feed_id is null;

-- Swaps one feed's busy times in one transaction.
create or replace function public.coach_replace_feed_busy(p_feed uuid, p_rows jsonb) returns int
language plpgsql security definer set search_path to '' as $$
declare t uuid; n int;
begin
  select trainer_id into t from public.coach_calendar_feeds where id = p_feed;
  if t is null then return 0; end if;
  delete from public.coach_external_busy where feed_id = p_feed;
  insert into public.coach_external_busy (trainer_id, feed_id, starts_at, ends_at, title)
    select t, p_feed, (r ->> 'starts_at')::timestamptz, (r ->> 'ends_at')::timestamptz, left(r ->> 'title', 200)
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
     where (r ->> 'ends_at')::timestamptz > (r ->> 'starts_at')::timestamptz;
  get diagnostics n = row_count;
  update public.coach_calendar_feeds set synced_at = now(), error = null, events = n where id = p_feed;
  update public.coach_trainer_details set busy_synced_at = now(), busy_error = null where user_id = t;
  return n;
end $$;
revoke all on function public.coach_replace_feed_busy(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.coach_replace_feed_busy(uuid, jsonb) to service_role;
