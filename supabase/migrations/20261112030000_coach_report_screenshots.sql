-- platform-only: storage bucket for "Report a problem" screenshots (skipped by the local RLS tests)
-- coach-reports/{reporter uid}/{draft id}.(jpg|png|webp), at most 2 MB, images only. Private: the reporter and the
-- reviewers of that report can open it; nobody else.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-reports', 'coach-reports', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy coach_reports_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-reports' and split_part(name, '/', 1) = (select auth.uid())::text
              and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
create policy coach_reports_read on storage.objects for select to authenticated
  using (bucket_id = 'coach-reports' and (split_part(name, '/', 1) = (select auth.uid())::text
         or exists (select 1 from public.coach_exercise_reports r where r.screenshot_path = name and public.coach_report_reviewer(r.owner_id))));
