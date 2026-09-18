-- À exécuter une seule fois dans Supabase SQL Editor.
-- Stockage privé d'un document PDF associé à chaque panne.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('panne-documents', 'panne-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf'];

drop policy if exists "members view panne documents" on storage.objects;
create policy "members view panne documents" on storage.objects
for select to authenticated
using (bucket_id = 'panne-documents' and exists (
  select 1 from public.toolmanager_members member
  where member.user_id = auth.uid() and member.active = true
));

drop policy if exists "admins manage panne documents" on storage.objects;
create policy "admins manage panne documents" on storage.objects
for all to authenticated
using (bucket_id = 'panne-documents' and exists (
  select 1 from public.toolmanager_members member
  where member.user_id = auth.uid() and member.active = true and member.role = 'admin'
))
with check (bucket_id = 'panne-documents' and exists (
  select 1 from public.toolmanager_members member
  where member.user_id = auth.uid() and member.active = true and member.role = 'admin'
));
