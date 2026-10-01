-- Expedit ToolManager · pièces jointes des achats et tickets d'achat.
-- À exécuter une seule fois dans Supabase > SQL Editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'achat-attachments',
  'achat-attachments',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv', 'application/zip', 'application/x-zip-compressed',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members view achat attachments" on storage.objects;
create policy "members view achat attachments" on storage.objects
for select to authenticated
using (bucket_id = 'achat-attachments' and exists (
  select 1 from public.toolmanager_members member
  where member.user_id = (select auth.uid()) and member.active = true
));

drop policy if exists "members upload own achat attachments" on storage.objects;
create policy "members upload own achat attachments" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'achat-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.toolmanager_members member
    where member.user_id = (select auth.uid()) and member.active = true
  )
);

drop policy if exists "owners and admins delete achat attachments" on storage.objects;
create policy "owners and admins delete achat attachments" on storage.objects
for delete to authenticated
using (
  bucket_id = 'achat-attachments'
  and exists (
    select 1 from public.toolmanager_members member
    where member.user_id = (select auth.uid()) and member.active = true
  )
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.toolmanager_members member
      where member.user_id = (select auth.uid())
        and member.active = true and member.role = 'admin'
    )
  )
);
