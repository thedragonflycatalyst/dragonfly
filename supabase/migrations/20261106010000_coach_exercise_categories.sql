-- Trainers' own exercises can use the Coach library's categories (the earlier lowercase ones stay valid for saved rows).
alter table public.coach_exercises drop constraint if exists coach_exercises_category_check;
alter table public.coach_exercises add constraint coach_exercises_category_check check (category in (
  'strength', 'stretching', 'plyometrics', 'cardio', 'powerlifting', 'olympic weightlifting', 'strongman', 'mobility', 'suspension',
  'Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Bodyweight', 'Calisthenics', 'Suspension (TRX)', 'Bands', 'Landmine',
  'Medicine ball', 'Stability ball', 'Sandbag', 'Plates', 'Sled', 'Strongman', 'Powerlifting', 'Olympic lifting', 'Plyometrics',
  'Speed and agility', 'Cardio', 'Conditioning', 'Abs and core', 'Stretching', 'Mobility', 'Yoga', 'Pilates', 'Corrective'));
alter table public.coach_exercises alter column category set default 'Bodyweight';
