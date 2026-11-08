-- Library suggestions are decided by the AI review, not by a person (owner decision 2026-11-06). The coach-exercise-submit
-- function now applies its decision straight away: another name for an existing move becomes a search name ('alias'), a
-- distinct, well-described variation joins the library ('added'). Thin or unsafe suggestions get feedback the trainer can act
-- on and resubmit. When a trainer can't get past the AI on something that clearly needs a person, they escalate it
-- (coach_escalate_submission); escalations and exercise reports are what a Dragonfly admin sees, and an admin can remove an
-- addition or a search name that turned out wrong (coach_remove_library_item).

alter table public.coach_exercise_submissions drop constraint coach_exercise_submissions_outcome_check;
alter table public.coach_exercise_submissions add constraint coach_exercise_submissions_outcome_check
  check (outcome in ('pending', 'approved', 'declined', 'already_listed', 'needs_detail', 'rejected', 'added', 'alias', 'escalated'));
alter table public.coach_exercise_submissions
  add column escalated_from text,
  add column escalation_note text check (char_length(escalation_note) <= 2000),
  add column escalated_at timestamptz;
create index coach_exercise_submissions_escalated_idx on public.coach_exercise_submissions (escalated_at) where outcome = 'escalated';

-- A trainer asks a person to look at one of their suggestions (at most 10 a day)
create function public.coach_escalate_submission(sid uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.coach_exercise_submissions;
begin
  select * into s from public.coach_exercise_submissions where id = sid and trainer_id = auth.uid() for update;
  if s.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if s.outcome in ('escalated', 'pending') then raise exception 'already_escalated' using errcode = 'P0001'; end if;
  if char_length(coalesce(trim(note), '')) < 10 then raise exception 'explain_more' using errcode = 'P0001'; end if;
  if (select count(*) from public.coach_exercise_submissions where trainer_id = auth.uid() and escalated_at > now() - interval '1 day') >= 10 then
    raise exception 'escalation_limit' using errcode = 'P0001';
  end if;
  update public.coach_exercise_submissions set escalated_from = s.outcome, outcome = 'escalated', escalation_note = left(trim(note), 2000), escalated_at = now()
  where id = s.id;
end $$;
revoke execute on function public.coach_escalate_submission(uuid, text) from public, anon;
grant execute on function public.coach_escalate_submission(uuid, text) to authenticated;

-- Admins now decide escalations (and anything still pending from before)
create or replace function public.coach_review_submission(sid uuid, approve boolean, note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare s public.coach_exercise_submissions; n text;
begin
  if not public.dragonfly_is_admin() then raise exception 'admins_only' using errcode = '42501'; end if;
  select * into s from public.coach_exercise_submissions where id = sid for update;
  if s.id is null or s.outcome not in ('pending', 'escalated') then raise exception 'not_pending' using errcode = 'P0001'; end if;
  if approve and coalesce(s.escalated_from, '') not in ('added', 'alias') then
    if s.proposal->>'kind' = 'alias' then
      for n in select jsonb_array_elements_text(s.proposal->'names') loop
        insert into public.coach_library_aliases (ref, alias, submission_id) values (s.proposal->>'ref', n, s.id) on conflict do nothing;
      end loop;
    elsif s.proposal->>'kind' = 'add' then
      insert into public.coach_library_extra (ref, data, submission_id) values (s.proposal->>'ref', s.proposal->'row', s.id) on conflict (ref) do nothing;
    else raise exception 'no_proposal' using errcode = 'P0001';
    end if;
  end if;
  update public.coach_exercise_submissions set outcome = case when approve then 'approved' else 'declined' end,
    review_note = left(note, 1000), reviewed_by = auth.uid(), reviewed_at = now() where id = s.id;
  return case when approve then 'approved' else 'declined' end;
end $$;

-- Admins take back an addition (and its search names) or a single search name
create function public.coach_remove_library_item(item_ref text, alias text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.dragonfly_is_admin() then raise exception 'admins_only' using errcode = '42501'; end if;
  if alias is null then
    delete from public.coach_library_extra where ref = item_ref;
    delete from public.coach_library_aliases where ref = item_ref;
  else
    delete from public.coach_library_aliases a where a.ref = item_ref and lower(a.alias) = lower(alias);
  end if;
end $$;
revoke execute on function public.coach_remove_library_item(text, text) from public, anon;
grant execute on function public.coach_remove_library_item(text, text) to authenticated;
