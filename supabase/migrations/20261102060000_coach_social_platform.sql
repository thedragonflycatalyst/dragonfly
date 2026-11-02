-- platform-only: storage buckets, realtime and the app admin (skipped by the local RLS tests)

-- Chat and community attachments: coach-social/{chat|community}/{id}/{name}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-social', 'coach-social', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm',
              'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/wav',
              'application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;
create policy coach_social_read on storage.objects for select to authenticated
  using (bucket_id = 'coach-social' and public.coach_social_ok(name));
create policy coach_social_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-social' and public.coach_social_ok(name)
              and (split_part(name, '/', 1) <> 'chat' or public.coach_chat_member(split_part(name, '/', 2)::uuid)));
create policy coach_social_delete on storage.objects for delete to authenticated
  using (bucket_id = 'coach-social' and owner_id = (select auth.uid())::text);

-- The media bucket now also holds resources (guides, PDFs, audio), the Files library and branding
update storage.buckets set allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/mp4', 'audio/mpeg', 'audio/x-m4a', 'audio/wav', 'application/pdf', 'text/plain', 'text/csv', 'application/zip',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
 where id = 'coach-media';
drop policy if exists coach_media_upload on storage.objects;
create policy coach_media_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-media' and public.coach_manages_text(split_part(name, '/', 1))
              and split_part(name, '/', 2) in ('exercises', 'covers', 'resources', 'files', 'branding'));

-- Live updates for chat
alter publication supabase_realtime add table public.coach_messages, public.coach_message_reactions, public.coach_chat_members;

-- The Dragonfly owner reads issue reports
insert into public.dragonfly_admins (user_id) select id from auth.users where lower(email) = 'thedragonflycatalyst@outlook.com' on conflict do nothing;
