-- Dragonfly (coaching): richer custom exercises, like My PT Hub's Create Exercise.
-- muscles = main muscle(s); secondary_muscles = other muscles worked; image_path = demo image in coach-media;
-- alternatives = exercises a client may swap to ('lib:<id>' or 'my:<uuid>').
alter table public.coach_exercises
  add column category text not null default 'strength'
    check (category in ('strength', 'stretching', 'plyometrics', 'cardio', 'powerlifting', 'olympic weightlifting', 'strongman', 'mobility', 'suspension')),
  add column secondary_muscles text[] not null default '{}' check (cardinality(secondary_muscles) <= 20),
  add column image_path text check (char_length(image_path) <= 300),
  add column alternatives text[] not null default '{}' check (cardinality(alternatives) <= 12);

-- Every alternative must look like an exercise reference
create function public.coach_exercise_refs_ok(refs text[]) returns boolean
language sql immutable set search_path = '' as
$$ select coalesce(bool_and(r ~ '^(lib|my):[A-Za-z0-9_.()\-]{1,120}$'), true) from unnest(refs) r $$;
alter table public.coach_exercises add constraint coach_exercises_alternatives_refs check (public.coach_exercise_refs_ok(alternatives));
