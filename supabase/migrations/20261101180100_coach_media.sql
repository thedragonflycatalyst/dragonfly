-- platform-only: private bucket for trainers' exercise demo videos and images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-media', 'coach-media', false, 104857600,
        array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy coach_media_read on storage.objects for select to authenticated
  using (bucket_id = 'coach-media' and public.coach_media_ok(name));
create policy coach_media_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-media' and split_part(name, '/', 1) = (select auth.uid())::text and split_part(name, '/', 2) = 'exercises');
create policy coach_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'coach-media' and split_part(name, '/', 1) = (select auth.uid())::text);
