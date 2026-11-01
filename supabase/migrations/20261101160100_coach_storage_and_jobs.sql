-- platform-only: Supabase storage and scheduled jobs (skipped by the local RLS tests, which have neither)

-- Private bucket for progress photos and client files. Path: {trainer_id}/{client_id}/{photos|files}/{name}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-private', 'coach-private', false, 26214400,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'text/plain', 'text/csv',
              'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create policy coach_private_read on storage.objects for select to authenticated
  using (bucket_id = 'coach-private' and public.coach_storage_ok(name));
create policy coach_private_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-private' and public.coach_storage_ok(name));
-- Trainers can remove anything for their clients; clients only what they uploaded
create policy coach_private_delete on storage.objects for delete to authenticated
  using (bucket_id = 'coach-private' and public.coach_storage_ok(name)
         and (split_part(name, '/', 1) = (select auth.uid())::text or owner_id = (select auth.uid())::text));

-- Daily automatic freeze of inactive clients (07:17 UTC)
create extension if not exists pg_cron;
select cron.schedule('coach-auto-freeze', '17 7 * * *', $$select public.coach_auto_freeze()$$);
