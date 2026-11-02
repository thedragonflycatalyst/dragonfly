-- platform-only: team owners can manage files and media in their trainers' folders
drop policy if exists coach_media_upload on storage.objects;
create policy coach_media_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-media' and public.coach_manages_text(split_part(name, '/', 1)) and split_part(name, '/', 2) in ('exercises', 'covers'));
drop policy if exists coach_media_delete on storage.objects;
create policy coach_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'coach-media' and public.coach_manages_text(split_part(name, '/', 1)));
drop policy if exists coach_private_delete on storage.objects;
create policy coach_private_delete on storage.objects for delete to authenticated
  using (bucket_id = 'coach-private' and public.coach_storage_ok(name)
         and (public.coach_manages_text(split_part(name, '/', 1)) or owner_id = (select auth.uid())::text));
