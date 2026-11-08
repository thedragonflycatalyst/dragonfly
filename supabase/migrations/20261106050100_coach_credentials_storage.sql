-- platform-only: certificate files go in each person's own coach-media/{user}/credentials/ folder (trainers and clients)
drop policy if exists coach_media_upload on storage.objects;
create policy coach_media_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-media' and (
    (public.coach_manages_text(split_part(name, '/', 1)) and split_part(name, '/', 2) in ('exercises', 'covers', 'resources', 'files', 'branding'))
    or (split_part(name, '/', 1) = (select auth.uid())::text and split_part(name, '/', 2) = 'credentials')));
