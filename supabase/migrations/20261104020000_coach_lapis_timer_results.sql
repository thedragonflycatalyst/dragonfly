-- Structured Lapis timing results alongside Coach exercise sets.
-- Kept separate from entries so timed circuits are never counted as weights/reps.
alter table public.coach_logs
  add column timer_results jsonb not null default '[]'::jsonb
    check (jsonb_typeof(timer_results) = 'array' and jsonb_array_length(timer_results) <= 200);

comment on column public.coach_logs.timer_results is
  'Completed linked Lapis timer runs: block_id, timer_id, name, planned_seconds, actual_seconds, completed_at. One result per workout block, stored with the workout log.';
