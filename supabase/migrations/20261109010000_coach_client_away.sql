-- Owner request, 2026-11-08: an "away" note on a client (out of the country, injured, ...) with dates, so the trainer
-- doesn't chase them while they're gone. The Clients list splits into Active / Away / Inactive / Archived from this.
-- Only the trainer writes these (clients can read their own row but not update it).
alter table public.coach_clients
  add column away_reason text check (away_reason in ('travel', 'injury', 'illness', 'personal', 'other')),
  add column away_from date,
  add column away_until date,
  add column away_note text check (char_length(away_note) <= 500),
  add constraint coach_clients_away_dates check (away_until is null or away_from is null or away_until >= away_from),
  add constraint coach_clients_away_reason check (away_reason is not null or (away_from is null and away_until is null and away_note is null));

-- Daily auto-freeze leaves away clients alone, and gives them two weeks after their return date to come back in
create or replace function public.coach_auto_freeze() returns int
language plpgsql security definer set search_path = '' as
$$
declare v_n int;
begin
  update public.coach_clients c set status = 'frozen', frozen_reason = 'inactive'
    from public.coach_trainers t
   where t.user_id = c.trainer_id and c.status = 'active' and c.last_session_at is not null
     and c.last_session_at < now() - make_interval(days => t.auto_freeze_days)
     and (c.away_reason is null or (c.away_until is not null and c.away_until < current_date - 14));
  get diagnostics v_n = row_count;
  return v_n;
end
$$;
