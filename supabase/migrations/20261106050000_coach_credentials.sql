-- Credentials: a directory of things people in fitness can earn (trainer certifications and client challenges), plus each
-- person's own record of what they hold or are working toward, with an optional certificate file. Directory entries link
-- to the official source; Dragonfly does not award or sell them. Requirements change, so each entry shows when it was last
-- checked and the app tells people to confirm details on the official site.

create table public.coach_credential_catalog (
  id text primary key check (id ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (char_length(name) between 2 and 160),
  org text not null check (char_length(org) between 2 and 120),
  url text not null check (url ~ '^https://'),
  discipline text not null check (discipline in ('personal training', 'strength', 'kettlebell', 'specialty', 'nutrition', 'pilates', 'yoga',
    'group fitness', 'aquatics', 'safety', 'challenge')),
  audience text not null check (audience in ('trainer', 'client', 'both')),
  summary text not null check (char_length(summary) <= 600),
  verified_on date,
  active boolean not null default true,
  sort int not null default 100
);

create table public.coach_user_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  catalog_id text references public.coach_credential_catalog(id) on delete set null,
  name text not null check (char_length(name) between 2 and 160),      -- copied from the catalog, or the person's own
  org text check (char_length(org) <= 120),
  status text not null default 'held' check (status in ('held', 'working')),
  earned_on date,
  expires_on date,
  file_path text check (file_path is null or file_path ~ '^[0-9a-f-]{36}/credentials/'),
  note text check (char_length(note) <= 1000),
  show_on_profile boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_user_credentials_user_idx on public.coach_user_credentials (user_id);
create trigger coach_user_credentials_touch before update on public.coach_user_credentials for each row execute function public.coach_touch();

-- A file must sit in the owner's own credentials folder
create function public.coach_user_credential_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.file_path is not null and split_part(new.file_path, '/', 1) <> new.user_id::text then
    raise exception 'not_your_file' using errcode = '42501';
  end if;
  if (select count(*) from public.coach_user_credentials where user_id = new.user_id) >= 200 and tg_op = 'INSERT' then
    raise exception 'credential_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger coach_user_credential_guard before insert or update on public.coach_user_credentials for each row execute function public.coach_user_credential_guard();
revoke execute on function public.coach_user_credential_guard() from public, anon, authenticated;

alter table public.coach_credential_catalog enable row level security;
alter table public.coach_user_credentials enable row level security;
revoke all on public.coach_credential_catalog, public.coach_user_credentials from anon;
grant select on public.coach_credential_catalog to authenticated;
grant insert, update, delete on public.coach_credential_catalog to authenticated;
grant select, insert, update, delete on public.coach_user_credentials to authenticated;
create policy coach_credential_catalog_read on public.coach_credential_catalog for select to authenticated using (true);
create policy coach_credential_catalog_admin on public.coach_credential_catalog for all to authenticated
  using ((select public.dragonfly_is_admin())) with check ((select public.dragonfly_is_admin()));
-- Your own record; anyone signed in can see credentials someone chose to show on their profile
create policy coach_user_credentials_own on public.coach_user_credentials for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy coach_user_credentials_shown on public.coach_user_credentials for select to authenticated
  using (show_on_profile and status = 'held');

-- Certificate files: coach-media/{user}/credentials/… readable by the owner only
create or replace function public.coach_media_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as
$$
  select case split_part(p_name, '/', 2)
    when 'credentials' then split_part(p_name, '/', 1) = auth.uid()::text
    when 'files' then
      public.coach_manages_text(split_part(p_name, '/', 1))
      or exists (select 1 from public.coach_library_files f join public.coach_file_shares s on s.file_id = f.id
                   join public.coach_clients c on c.id = s.client_id
                  where f.path = p_name and c.user_id = auth.uid() and c.status = 'active')
    when 'resources' then
      public.coach_manages_text(split_part(p_name, '/', 1))
      or exists (select 1 from public.coach_resources r where r.file_path = p_name and r.trainer_id::text = split_part(p_name, '/', 1)
                    and not r.archived and r.kind <> 'template' and r.audience <> 'none' and (r.expires_on is null or r.expires_on >= current_date)
                    and r.trainer_id in (select public.coach_my_trainer_ids())
                    and (r.audience = 'all' or public.coach_my_client_id(r.trainer_id) = any (r.client_ids)))
    else split_part(p_name, '/', 2) in ('exercises', 'covers', 'branding') and (
      public.coach_manages_text(split_part(p_name, '/', 1)) or public.coach_teammate_text(split_part(p_name, '/', 1))
      or exists (select 1 from public.coach_clients c
                  where c.trainer_id::text = split_part(p_name, '/', 1) and c.user_id = auth.uid() and c.status = 'active'))
  end
$$;

-- Starter directory (official sites; details change, so the app says to confirm on the site)
insert into public.coach_credential_catalog (id, name, org, url, discipline, audience, summary, sort) values
 ('nasm-cpt', 'Certified Personal Trainer (CPT)', 'NASM', 'https://www.nasm.org', 'personal training', 'trainer', 'NCCA-accredited personal training certification built on the OPT model.', 10),
 ('ace-cpt', 'Personal Trainer Certification', 'American Council on Exercise (ACE)', 'https://www.acefitness.org', 'personal training', 'trainer', 'NCCA-accredited personal training certification.', 11),
 ('acsm-cpt', 'Certified Personal Trainer (ACSM-CPT)', 'American College of Sports Medicine', 'https://www.acsm.org', 'personal training', 'trainer', 'Personal training certification from the sports-medicine college.', 12),
 ('nsca-cpt', 'Certified Personal Trainer (NSCA-CPT)', 'NSCA', 'https://www.nsca.com', 'personal training', 'trainer', 'Personal training certification from the National Strength and Conditioning Association.', 13),
 ('nsca-cscs', 'Certified Strength and Conditioning Specialist (CSCS)', 'NSCA', 'https://www.nsca.com', 'strength', 'trainer', 'Strength and conditioning credential for coaching athletes; requires a bachelor''s degree.', 14),
 ('issa-cpt', 'Certified Personal Trainer', 'ISSA', 'https://www.issaonline.com', 'personal training', 'trainer', 'Online personal training certification with specialist add-ons.', 15),
 ('nccpt-cpt', 'Certified Personal Trainer', 'NCCPT', 'https://www.nccpt.com', 'personal training', 'trainer', 'Accredited personal training certification.', 16),
 ('nfpt-cpt', 'Certified Personal Trainer', 'NFPT', 'https://www.nfpt.com', 'personal training', 'trainer', 'Accredited personal training certification.', 17),
 ('nasm-ces', 'Corrective Exercise Specialist (CES)', 'NASM', 'https://www.nasm.org', 'specialty', 'trainer', 'Assessing and correcting movement imbalances.', 30),
 ('nasm-pes', 'Performance Enhancement Specialist (PES)', 'NASM', 'https://www.nasm.org', 'specialty', 'trainer', 'Training athletes for performance.', 31),
 ('pn-l1', 'Precision Nutrition Level 1', 'Precision Nutrition', 'https://www.precisionnutrition.com', 'nutrition', 'trainer', 'Nutrition coaching certification focused on habits and coaching skills.', 32),
 ('fms', 'Functional Movement Screen (FMS)', 'Functional Movement Systems', 'https://www.functionalmovement.com', 'specialty', 'trainer', 'A screening system for movement quality.', 33),
 ('trx-stc', 'TRX Suspension Training Course', 'TRX', 'https://www.trxtraining.com', 'specialty', 'trainer', 'Education on coaching suspension training.', 34),
 ('animal-flow', 'Animal Flow Instructor', 'Animal Flow', 'https://www.animalflow.com', 'specialty', 'trainer', 'Ground-based bodyweight movement system.', 35),
 ('dvrt', 'DVRT Ultimate Sandbag Training', 'DVRT', 'https://www.dvrtfitness.com', 'specialty', 'trainer', 'Sandbag and functional strength education.', 36),
 ('sfg1', 'SFG I Kettlebell Instructor', 'StrongFirst', 'https://www.strongfirst.com', 'kettlebell', 'trainer', 'Kettlebell instructor certification with a strength and technique test.', 40),
 ('sfl', 'SFL Barbell Instructor', 'StrongFirst', 'https://www.strongfirst.com', 'strength', 'trainer', 'Barbell instructor certification.', 41),
 ('sfb', 'SFB Bodyweight Instructor', 'StrongFirst', 'https://www.strongfirst.com', 'strength', 'trainer', 'Bodyweight strength instructor certification.', 42),
 ('rkc', 'RKC Kettlebell Instructor', 'RKC (Dragon Door)', 'https://www.dragondoor.com', 'kettlebell', 'trainer', 'Kettlebell instructor certification.', 43),
 ('usaw-l1', 'Weightlifting Coach (Level 1)', 'USA Weightlifting', 'https://www.usaweightlifting.org', 'strength', 'trainer', 'Coaching the snatch and clean and jerk.', 44),
 ('crossfit-l1', 'CrossFit Level 1 Trainer', 'CrossFit', 'https://www.crossfit.com', 'strength', 'trainer', 'Entry-level CrossFit trainer course.', 45),
 ('bb-pilates', 'Pilates Instructor Training (mat and apparatus)', 'Balanced Body', 'https://www.pilates.com', 'pilates', 'trainer', 'Modular Pilates teacher training: mat, reformer and other apparatus.', 50),
 ('stott', 'STOTT PILATES Instructor Certification', 'Merrithew', 'https://www.merrithew.com', 'pilates', 'trainer', 'Pilates instructor training: mat, reformer and more.', 51),
 ('basi', 'BASI Pilates Teacher Training', 'BASI Pilates', 'https://www.basipilates.com', 'pilates', 'trainer', 'Comprehensive Pilates teacher training.', 52),
 ('pma', 'PMA Certified Pilates Teacher', 'Pilates Method Alliance', 'https://www.pilatesmethodalliance.org', 'pilates', 'trainer', 'Independent exam for Pilates teachers.', 53),
 ('ryt200', 'Registered Yoga Teacher (RYT 200 / 500)', 'Yoga Alliance', 'https://www.yogaalliance.org', 'yoga', 'trainer', 'Registration after completing a registered yoga teacher training.', 60),
 ('lesmills', 'Les Mills Instructor (program certifications)', 'Les Mills', 'https://www.lesmills.com', 'group fitness', 'trainer', 'Certifications to teach Les Mills programs such as BODYPUMP (Les Mills trademarks).', 70),
 ('ace-gfi', 'Group Fitness Instructor', 'American Council on Exercise (ACE)', 'https://www.acefitness.org', 'group fitness', 'trainer', 'Accredited group fitness instructor certification.', 71),
 ('spinning', 'Spinning Instructor', 'Spinning', 'https://www.spinning.com', 'group fitness', 'trainer', 'Indoor cycling instructor certification.', 72),
 ('zumba', 'Zumba Instructor', 'Zumba', 'https://www.zumba.com', 'group fitness', 'trainer', 'Dance-fitness instructor training.', 73),
 ('aea', 'Aquatic Fitness Professional', 'Aquatic Exercise Association (AEA)', 'https://www.aeawave.org', 'aquatics', 'trainer', 'Certification for teaching water exercise.', 80),
 ('redcross-cpr', 'CPR / AED / First Aid', 'American Red Cross', 'https://www.redcross.org', 'safety', 'both', 'Emergency response certification most gyms require.', 90),
 ('aha-cpr', 'Heartsaver CPR AED / BLS', 'American Heart Association', 'https://www.heart.org', 'safety', 'both', 'CPR and AED training.', 91),
 ('ss-timed', 'Simple & Sinister timed standard', 'StrongFirst', 'https://www.strongfirst.com', 'challenge', 'client', 'A kettlebell swing and get-up standard from the Simple & Sinister program.', 200),
 ('first-pullup', 'First strict pull-up', 'Dragonfly milestone', 'https://thedragonflycatalyst.github.io/dragonfly/', 'challenge', 'client', 'One strict pull-up from a dead hang, chin over the bar.', 210),
 ('pistol', 'Pistol squat', 'Dragonfly milestone', 'https://thedragonflycatalyst.github.io/dragonfly/', 'challenge', 'client', 'A full single-leg squat each side without support.', 211),
 ('bw-bench', 'Bodyweight bench press', 'Dragonfly milestone', 'https://thedragonflycatalyst.github.io/dragonfly/', 'challenge', 'client', 'Bench press your bodyweight for one rep.', 212),
 ('dl-2x', 'Double-bodyweight deadlift', 'Dragonfly milestone', 'https://thedragonflycatalyst.github.io/dragonfly/', 'challenge', 'client', 'Deadlift twice your bodyweight for one rep.', 213),
 ('first-5k', 'First 5K', 'Dragonfly milestone', 'https://thedragonflycatalyst.github.io/dragonfly/', 'challenge', 'client', 'Run or walk a 5K start to finish.', 214),
 ('first-marathon', 'First marathon', 'Dragonfly milestone', 'https://thedragonflycatalyst.github.io/dragonfly/', 'challenge', 'client', 'Finish a full marathon (26.2 miles).', 215);
