-- Dragonfly's own push notifications, shared by every Dragonfly app (owner 2026-11-07: "all our apps should use the
-- same notification and text system"). Phones register their token here with the app they belong to; the
-- dragonfly-push function sends through the owner's Firebase project (Android) and Apple (iPhone, once live).
-- Any app's server code sends with dragonfly-push { action: 'send', user_id, app, title, body, url, urgent }.
-- Coach: the moment a client asks to move a session, the database calls dragonfly-push.
create table public.dragonfly_push_tokens (
  token text primary key check (char_length(token) between 20 and 4096),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  app text not null default 'coach' check (app ~ '^[a-z][a-z0-9-]{1,30}$'),   -- coach, lapis, phoenix, books, uploader, …
  updated_at timestamptz not null default now()
);
create index dragonfly_push_tokens_user_idx on public.dragonfly_push_tokens (user_id);
alter table public.dragonfly_push_tokens enable row level security;
revoke all on public.dragonfly_push_tokens from anon;
grant select, insert, update, delete on public.dragonfly_push_tokens to authenticated;
create policy dragonfly_push_tokens_own on public.dragonfly_push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Register this phone for the signed-in user (a token moving to another account is taken over)
create function public.dragonfly_push_register(p_token text, p_platform text, p_app text default 'coach') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode = '42501'; end if;
  insert into public.dragonfly_push_tokens (token, user_id, platform, app) values (p_token, auth.uid(), p_platform, p_app)
    on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, app = excluded.app, updated_at = now();
end $$;
revoke execute on function public.dragonfly_push_register(text, text, text) from public, anon;
grant execute on function public.dragonfly_push_register(text, text, text) to authenticated;

-- A client asked to move a session: push it to the trainer now
create function public.coach_reschedule_push() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.dragonfly_push_tokens where user_id = new.trainer_id and app = 'coach') then
    perform net.http_post(
      url := 'https://fkksaivdznqbfsfsagsj.supabase.co/functions/v1/dragonfly-push',
      headers := jsonb_build_object('content-type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cron_secret')),
      body := jsonb_build_object('action', 'reschedule', 'request_id', new.id),
      timeout_milliseconds := 10000);
  end if;
  return null;
end $$;
create trigger coach_reschedule_push after insert on public.coach_reschedule_requests for each row execute function public.coach_reschedule_push();
revoke execute on function public.coach_reschedule_push() from public, anon, authenticated;
