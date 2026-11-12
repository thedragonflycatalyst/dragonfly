-- Beta "Report a problem" on every exercise (issue #58). Builds on coach_exercise_reports (20261106020000):
--  - any exercise can be reported: library ('lib:…') and a trainer's own ('my:<uuid>', reviewed by that trainer too)
--  - the app fills in the context (variant, entry revision, screen, app version); testers add a category, details,
--    the correction they expect and optionally a screenshot (private bucket, platform only)
--  - one send per draft (client_key), a short reference number back, and a history of every review step
--  - reviewers: Dragonfly admins (all reports) and the trainer who owns a 'my:' exercise. Statuses:
--    open (submitted) → reviewing → fixed → released; or duplicate / dismissed. Reporters see only their own reports
--    and their status, never other testers or reviewers' notes.
--  - corrections still go through the normal library review and release; nothing here edits the library.

alter table public.coach_exercise_reports drop constraint coach_exercise_reports_ref_check;
alter table public.coach_exercise_reports add constraint coach_exercise_reports_ref_check check (ref ~ '^(lib:[a-z0-9-]{1,124}|my:[0-9a-f-]{36})$');
alter table public.coach_exercise_reports drop constraint coach_exercise_reports_kind_check;
alter table public.coach_exercise_reports add constraint coach_exercise_reports_kind_check check (kind in (
  'name', 'instructions', 'muscles', 'media', 'duplicate', 'variations', 'difficulty', 'other',
  'redundant', 'wrong_video', 'unclear', 'unsafe'));     -- the last four: the first version's categories
alter table public.coach_exercise_reports drop constraint coach_exercise_reports_status_check;
alter table public.coach_exercise_reports add constraint coach_exercise_reports_status_check check (status in (
  'open', 'reviewing', 'fixed', 'released', 'duplicate', 'dismissed', 'resolved'));
alter table public.coach_exercise_reports
  add column ref_no bigint generated always as identity,
  add column client_key uuid,
  add column variant text check (char_length(variant) <= 120),
  add column revision text check (revision ~ '^[a-z0-9]{1,40}$'),
  add column screen text check (screen ~ '^[a-z][a-z0-9_-]{0,39}$'),
  add column app_version text check (char_length(app_version) <= 40),
  add column expected text check (char_length(expected) <= 1000),
  add column screenshot_path text check (screenshot_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  add column owner_id uuid references auth.users(id) on delete set null,   -- trainer who owns a 'my:' exercise
  add column assignee uuid references auth.users(id) on delete set null,
  add column duplicate_of uuid references public.coach_exercise_reports(id) on delete set null,
  add column updated_at timestamptz not null default now();
create unique index coach_exercise_reports_ref_no on public.coach_exercise_reports (ref_no);
create unique index coach_exercise_reports_once on public.coach_exercise_reports (user_id, client_key) where client_key is not null;
create index coach_exercise_reports_queue on public.coach_exercise_reports (status, created_at);
create index coach_exercise_reports_owner on public.coach_exercise_reports (owner_id) where owner_id is not null;

-- Who may review a report
create function public.coach_report_reviewer(p_owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.dragonfly_is_admin() or (p_owner is not null and p_owner = auth.uid())
$$;
revoke execute on function public.coach_report_reviewer(uuid) from public, anon;
grant execute on function public.coach_report_reviewer(uuid) to authenticated;

-- Reporters can't change a report after sending it; the context they send is fixed; at most 30 a day each
create or replace function public.coach_exercise_report_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.coach_exercise_reports where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
      raise exception 'report_limit' using errcode = 'P0001';
    end if;
    new.status := 'open'; new.admin_note := null; new.assignee := null; new.duplicate_of := null; new.updated_at := now();
    new.owner_id := case when new.ref like 'my:%' then (select e.trainer_id from public.coach_exercises e where e.id = substr(new.ref, 4)::uuid) end;
    if new.ref like 'my:%' and new.owner_id is null then raise exception 'no_such_exercise' using errcode = '22023'; end if;
    -- A screenshot must be in the reporter's own folder
    if new.screenshot_path is not null and split_part(new.screenshot_path, '/', 1) <> new.user_id::text then
      raise exception 'not_your_file' using errcode = '42501';
    end if;
  elsif (new.user_id, new.ref, new.name, new.kind, new.note, new.created_at, new.client_key, new.variant, new.revision, new.screen,
         new.app_version, new.expected, new.screenshot_path, new.owner_id, new.ref_no)
        is distinct from (old.user_id, old.ref, old.name, old.kind, old.note, old.created_at, old.client_key, old.variant, old.revision,
         old.screen, old.app_version, old.expected, old.screenshot_path, old.owner_id, old.ref_no) then
    raise exception 'report_locked' using errcode = 'P0001';
  else
    new.updated_at := now();
  end if;
  return new;
end $$;

-- Reports a reviewer can see: admins all, a trainer those about their own exercises
drop policy coach_exercise_reports_read on public.coach_exercise_reports;
create policy coach_exercise_reports_read on public.coach_exercise_reports for select to authenticated
  using (user_id = (select auth.uid()) or (select public.dragonfly_is_admin()) or owner_id = (select auth.uid()));
drop policy coach_exercise_reports_review on public.coach_exercise_reports;
create policy coach_exercise_reports_review on public.coach_exercise_reports for update to authenticated
  using ((select public.dragonfly_is_admin()) or owner_id = (select auth.uid()))
  with check ((select public.dragonfly_is_admin()) or owner_id = (select auth.uid()));

-- Every review step, kept
create table public.coach_exercise_report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.coach_exercise_reports(id) on delete cascade,
  at timestamptz not null default now(),
  by_user uuid references auth.users(id) on delete set null,
  status text,
  note text check (char_length(note) <= 1000)
);
create index coach_exercise_report_events_report on public.coach_exercise_report_events (report_id, at);
alter table public.coach_exercise_report_events enable row level security;
revoke all on public.coach_exercise_report_events from anon;
revoke insert, update, delete on public.coach_exercise_report_events from authenticated;
grant select on public.coach_exercise_report_events to authenticated;
create policy coach_exercise_report_events_read on public.coach_exercise_report_events for select to authenticated
  using (exists (select 1 from public.coach_exercise_reports r where r.id = report_id and public.coach_report_reviewer(r.owner_id)));

create function public.coach_exercise_report_log() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.coach_exercise_report_events (report_id, by_user, status) values (new.id, new.user_id, 'open');
  elsif new.status is distinct from old.status or new.admin_note is distinct from old.admin_note or new.assignee is distinct from old.assignee
        or new.duplicate_of is distinct from old.duplicate_of then
    insert into public.coach_exercise_report_events (report_id, by_user, status, note)
    values (new.id, auth.uid(), case when new.status is distinct from old.status then new.status end,
            case when new.admin_note is distinct from old.admin_note then new.admin_note
                 when new.assignee is distinct from old.assignee then 'assigned'
                 when new.duplicate_of is distinct from old.duplicate_of then 'marked duplicate' end);
  end if;
  return null;
end $$;
create trigger coach_exercise_report_log after insert or update on public.coach_exercise_reports for each row execute function public.coach_exercise_report_log();
revoke execute on function public.coach_exercise_report_log() from public, anon, authenticated;

-- Send a report. Sending the same draft again (a retry after a dropped connection) returns the first one.
create function public.coach_report_exercise(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); k uuid; r public.coach_exercise_reports%rowtype;
begin
  if me is null then raise exception 'sign_in_required' using errcode = '42501'; end if;
  k := nullif(p->>'client_key', '')::uuid;
  if k is not null then
    select * into r from public.coach_exercise_reports where user_id = me and client_key = k;
    if found then return jsonb_build_object('id', r.id, 'ref_no', r.ref_no, 'again', true); end if;
  end if;
  insert into public.coach_exercise_reports (user_id, ref, name, kind, note, client_key, variant, revision, screen, app_version, expected, screenshot_path)
  values (me, p->>'ref', left(trim(p->>'name'), 120), p->>'kind', nullif(left(trim(coalesce(p->>'note', '')), 1000), ''), k,
          nullif(left(trim(coalesce(p->>'variant', '')), 120), ''), nullif(p->>'revision', ''), nullif(p->>'screen', ''),
          nullif(left(p->>'app_version', 40), ''), nullif(left(trim(coalesce(p->>'expected', '')), 1000), ''), nullif(p->>'screenshot_path', ''))
  returning * into r;
  return jsonb_build_object('id', r.id, 'ref_no', r.ref_no, 'again', false);
end $$;
revoke execute on function public.coach_report_exercise(jsonb) from public, anon;
grant execute on function public.coach_report_exercise(jsonb) to authenticated;

-- Review a report: status, a note, assign (to yourself or clear), or mark a duplicate of another report number
create function public.coach_review_report(p_id uuid, p_status text default null, p_note text default null, p_assign_me boolean default null, p_duplicate_of bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.coach_exercise_reports%rowtype; dup uuid;
begin
  select * into r from public.coach_exercise_reports where id = p_id for update;
  if not found or not public.coach_report_reviewer(r.owner_id) then raise exception 'reviewers_only' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('open', 'reviewing', 'fixed', 'released', 'duplicate', 'dismissed') then raise exception 'bad_status' using errcode = '22023'; end if;
  if p_duplicate_of is not null then
    select id into dup from public.coach_exercise_reports where ref_no = p_duplicate_of and id <> p_id;
    if dup is null then raise exception 'no_such_report' using errcode = '22023'; end if;
  end if;
  update public.coach_exercise_reports set
    status = case when dup is not null then 'duplicate' else coalesce(p_status, status) end,
    admin_note = coalesce(nullif(left(trim(coalesce(p_note, '')), 1000), ''), admin_note),
    assignee = case when p_assign_me is null then assignee when p_assign_me then auth.uid() else null end,
    duplicate_of = coalesce(dup, duplicate_of)
  where id = p_id;
end $$;
revoke execute on function public.coach_review_report(uuid, text, text, boolean, bigint) from public, anon;
grant execute on function public.coach_review_report(uuid, text, text, boolean, bigint) to authenticated;

-- A new report alerts the reviewers' phones (dragonfly-push looks them up; nothing is sent until push is set up)
create function public.coach_exercise_report_push() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.dragonfly_push_tokens t where t.app = 'coach'
             and (t.user_id in (select user_id from public.dragonfly_admins) or t.user_id = new.owner_id)) then
    perform net.http_post(
      url := 'https://fkksaivdznqbfsfsagsj.supabase.co/functions/v1/dragonfly-push',
      headers := jsonb_build_object('content-type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cron_secret')),
      body := jsonb_build_object('action', 'exercise_report', 'report_id', new.id),
      timeout_milliseconds := 10000);
  end if;
  return null;
end $$;
create trigger coach_exercise_report_push after insert on public.coach_exercise_reports for each row execute function public.coach_exercise_report_push();
revoke execute on function public.coach_exercise_report_push() from public, anon, authenticated;
