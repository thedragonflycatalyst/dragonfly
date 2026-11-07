-- Linked calendars (e.g. the owner's ClubAutomation staff feed) refresh every 5 minutes on their own, so a moved or
-- cancelled appointment reaches the website's booking calendar within minutes (owner decision, Nov 6, 2026).

alter table public.coach_trainer_details add column if not exists busy_synced_at timestamptz;
alter table public.coach_trainer_details add column if not exists busy_error text check (char_length(busy_error) <= 100);

-- Swaps a trainer's busy times in one transaction, so there is never a moment with none (a booking could slip in).
create or replace function public.coach_replace_busy(p_trainer uuid, p_rows jsonb) returns int
language plpgsql security definer set search_path to '' as $$
declare n int;
begin
  delete from public.coach_external_busy where trainer_id = p_trainer;
  insert into public.coach_external_busy (trainer_id, starts_at, ends_at, title)
    select p_trainer, (r ->> 'starts_at')::timestamptz, (r ->> 'ends_at')::timestamptz, left(r ->> 'title', 200)
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
     where (r ->> 'ends_at')::timestamptz > (r ->> 'starts_at')::timestamptz;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.coach_replace_busy(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.coach_replace_busy(uuid, jsonb) to service_role;

-- Shared secret for scheduled calls into functions; it lives only in the vault.
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'calendar_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'calendar_cron_secret', 'pg_cron → coach-calendar and website reminders');
  end if;
end $$;
create or replace function public.coach_cron_ok(p text) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce(length(p) >= 32 and p = (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cron_secret'), false) $$;
revoke all on function public.coach_cron_ok(text) from public, anon, authenticated;
grant execute on function public.coach_cron_ok(text) to service_role;

select cron.unschedule('coach-busy-refresh') where exists (select 1 from cron.job where jobname = 'coach-busy-refresh');
select cron.schedule('coach-busy-refresh', '*/5 * * * *', $c$
  select net.http_post(
    url := 'https://fkksaivdznqbfsfsagsj.supabase.co/functions/v1/coach-calendar',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cron_secret')),
    body := '{"action":"refresh_all"}'::jsonb,
    timeout_milliseconds := 60000)
$c$);
