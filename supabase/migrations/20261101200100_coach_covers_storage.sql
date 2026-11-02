-- platform-only: trainers can upload their own cover art to coach-media/{trainer_id}/covers/
drop policy if exists coach_media_upload on storage.objects;
create policy coach_media_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-media' and split_part(name, '/', 1) = (select auth.uid())::text and split_part(name, '/', 2) in ('exercises', 'covers'));
