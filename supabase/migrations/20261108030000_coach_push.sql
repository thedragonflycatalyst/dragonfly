-- Dragonfly's own push notifications (owner 2026-11-07: reschedule requests must reach the trainer's phone like an
-- amber alert, through our own system). Phones register their push token here; the coach-push function sends through
-- the owner's Firebase project (FCM). The moment a client asks to move a session, the database calls coach-push.
create table public.coach_push_tokens (
  token text primary key check (char_length(token) between 20 and 4096),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);
create index coach_push_tokens_user_idx on public.coach_push_tokens (user_id);
alter table public.coach_push_tokens enable row level security;
revoke all on public.coach_push_tokens from anon;
grant select, insert, update, delete on public.coach_push_tokens to authenticated;
create policy coach_push_tokens_own on public.coach_push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Register this phone for the signed-in user (a token moving to another account is taken over)
create function public.coach_push_register(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode = '42501'; end if;
  insert into public.coach_push_tokens (token, user_id, platform) values (p_token, auth.uid(), p_platform)
    on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;
revoke execute on function public.coach_push_register(text, text) from public, anon;
grant execute on function public.coach_push_register(text, text) to authenticated;

-- A client asked to move a session: push it to the trainer now
create function public.coach_reschedule_push() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.coach_push_tokens where user_id = new.trainer_id) then
    perform net.http_post(
      url := 'https://fkksaivdznqbfsfsagsj.supabase.co/functions/v1/coach-push',
      headers := jsonb_build_object('content-type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cron_secret')),
      body := jsonb_build_object('action', 'reschedule', 'request_id', new.id),
      timeout_milliseconds := 10000);
  end if;
  return null;
end $$;
create trigger coach_reschedule_push after insert on public.coach_reschedule_requests for each row execute function public.coach_reschedule_push();
revoke execute on function public.coach_reschedule_push() from public, anon, authenticated;
