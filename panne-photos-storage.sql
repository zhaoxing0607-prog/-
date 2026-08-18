-- À exécuter une seule fois dans Supabase SQL Editor.
-- Stockage privé des photos de panne : 2 photos maximum est contrôlé par l'application.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('panne-photos', 'panne-photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "members view panne photos" on storage.objects;
create policy "members view panne photos" on storage.objects
for select to authenticated
using (bucket_id = 'panne-photos' and exists (
  select 1 from public.toolmanager_members member
  where member.user_id = auth.uid() and member.active = true
));

drop policy if exists "admins manage panne photos" on storage.objects;
create policy "admins manage panne photos" on storage.objects
for all to authenticated
using (bucket_id = 'panne-photos' and exists (
  select 1 from public.toolmanager_members member
  where member.user_id = auth.uid() and member.active = true and member.role = 'admin'
))
with check (bucket_id = 'panne-photos' and exists (
  select 1 from public.toolmanager_members member
  where member.user_id = auth.uid() and member.active = true and member.role = 'admin'
));
