-- Consents a person gives in the app (AI photo processing first; messaging consents come later).
-- Append-only: the newest row for a kind is the current answer, so the record shows exactly what was agreed and when.

create table public.coach_user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ai_photos')),
  version int not null check (version between 1 and 1000),
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index coach_user_consents_user_idx on public.coach_user_consents (user_id, kind, created_at desc);

alter table public.coach_user_consents enable row level security;
revoke all on public.coach_user_consents from anon;
grant select, insert on public.coach_user_consents to authenticated;
create policy coach_user_consents_own_read on public.coach_user_consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy coach_user_consents_own_add on public.coach_user_consents for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Current answer for the signed-in person
create function public.coach_consent_current(p_kind text) returns table (version int, granted boolean, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select c.version, c.granted, c.created_at from public.coach_user_consents c
  where c.user_id = (select auth.uid()) and c.kind = p_kind order by c.created_at desc, c.id desc limit 1
$$;
grant execute on function public.coach_consent_current(text) to authenticated;
