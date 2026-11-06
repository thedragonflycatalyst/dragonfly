-- Swap suggestions from real use, and a small picture gallery on trainers' own exercises.
--
-- coach_popular_swaps: what people actually swap an exercise for, counted across every logged workout (only exercise
-- references and counts come back, never who). Logs record the original exercise as swapped_from_ref (and, in older logs,
-- only its name as swapped_from).
create function public.coach_popular_swaps(from_ref text, from_name text default null, max_rows int default 8)
returns table (ref text, name text, uses bigint)
language sql stable security definer set search_path = '' as $$
  select (e->'ex'->>'src') || ':' || (e->'ex'->>'id') as ref, max(e->'ex'->>'name') as name, count(*) as uses
  from public.coach_logs l, jsonb_array_elements(l.entries) e
  where auth.uid() is not null and e ? 'ex' and e->'ex'->>'src' = 'lib' and (e->'ex'->>'src') || ':' || (e->'ex'->>'id') <> from_ref
    and (e->>'swapped_from_ref' = from_ref or (from_name is not null and e->>'swapped_from_ref' is null and lower(e->>'swapped_from') = lower(from_name)))
  group by 1
  order by uses desc, name
  limit least(greatest(max_rows, 1), 20)
$$;
revoke execute on function public.coach_popular_swaps(text, text, int) from public, anon;
grant execute on function public.coach_popular_swaps(text, text, int) to authenticated;
create index coach_logs_swaps_idx on public.coach_logs using gin (entries jsonb_path_ops);

-- Hand positions, stances and other stills: [{ path (coach-media storage path) or url, caption }], at most 8
alter table public.coach_exercises add column gallery jsonb not null default '[]'
  check (jsonb_typeof(gallery) = 'array' and jsonb_array_length(gallery) <= 8);
