-- Run in the existing ToolManager Supabase project before publishing the UI.
-- This migration does not give the account broader business permissions.
begin;

do $$
begin
  if not exists (
    select 1 from auth.users u
    join public.toolmanager_members m on m.user_id = u.id
    where lower(u.email) = 'be@pageot.eu' and u.email_confirmed_at is not null
      and m.active and m.role = 'admin'
  ) then
    raise exception 'be@pageot.eu must be a confirmed active ToolManager administrator; no policies were changed.';
  end if;
end $$;

create or replace function public.toolmanager_attachment_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    join public.toolmanager_members m on m.user_id = u.id
    where u.id = (select auth.uid()) and lower(u.email) = 'be@pageot.eu'
      and u.email_confirmed_at is not null and m.active and m.role = 'admin'
  );
$$;

-- Restrictive policies are evaluated in addition to existing permissive policies.
-- Read/signing policies stay unchanged; unrelated buckets stay unaffected.
drop policy if exists "toolmanager attachment owner insert" on storage.objects;
create policy "toolmanager attachment owner insert" on storage.objects
as restrictive for insert to public
with check (bucket_id not in ('achat-attachments', 'panne-photos', 'panne-documents')
            or (select public.toolmanager_attachment_owner()));

drop policy if exists "toolmanager attachment owner update" on storage.objects;
create policy "toolmanager attachment owner update" on storage.objects
as restrictive for update to public
using (bucket_id not in ('achat-attachments', 'panne-photos', 'panne-documents')
       or (select public.toolmanager_attachment_owner()))
with check (bucket_id not in ('achat-attachments', 'panne-photos', 'panne-documents')
            or (select public.toolmanager_attachment_owner()));

drop policy if exists "toolmanager attachment owner delete" on storage.objects;
create policy "toolmanager attachment owner delete" on storage.objects
as restrictive for delete to public
using (bucket_id not in ('achat-attachments', 'panne-photos', 'panne-documents')
       or (select public.toolmanager_attachment_owner()));

-- Also protect the stored attachment references, not just the storage objects.
-- Keys and entity IDs identify their owner without treating reordering as an edit.
create or replace function public.toolmanager_attachment_manifest(payload jsonb)
returns jsonb
language sql immutable
set search_path = ''
as $$
  with recursive nodes(location, item) as (
    select array[]::text[], coalesce(payload, '{}'::jsonb)
    union all
    select n.location || child.location, child.item
    from nodes n
    cross join lateral (
      select 'key:' || e.key as location, e.value as item
      from jsonb_each(case when jsonb_typeof(n.item) = 'object' then n.item else '{}'::jsonb end) e
      union all
      select coalesce('id:' || (e.value->>'id'), 'item:'), e.value
      from jsonb_array_elements(case when jsonb_typeof(n.item) = 'array' then n.item else '[]'::jsonb end) e
    ) child
  )
  select coalesce(jsonb_agg(jsonb_build_array(location, item) order by location, item), '[]'::jsonb)
  from nodes
  where (jsonb_typeof(item->'path') = 'string'
    and location && array['key:attachments', 'key:documents', 'key:photos', 'key:document', 'key:drawing2d', 'key:model3d', 'key:invoices', 'key:invoiceLibrary'])
    or (location[array_length(location, 1)] = 'key:invoiceFileId' and jsonb_typeof(item) = 'string' and item <> '""'::jsonb);
$$;

create or replace function public.toolmanager_guard_attachment_manifest()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  before_data jsonb;
  after_data jsonb;
begin
  if auth.role() in ('authenticated', 'anon')
    and not public.toolmanager_attachment_owner() then
    before_data := case when tg_op <> 'INSERT' then to_jsonb(old) end;
    after_data := case when tg_op <> 'DELETE' then to_jsonb(new) end;
    if public.toolmanager_attachment_manifest(before_data) <> public.toolmanager_attachment_manifest(after_data) then
      raise exception 'Les pièces jointes sont en lecture seule pour ce compte.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  tab text;
begin
  foreach tab in array array['toolmanager_state', 'toolmanager_achat_tickets', 'toolmanager_panne_tickets', 'toolmanager_press_project_tickets'] loop
    if to_regclass('public.' || tab) is not null then
      execute format('drop trigger if exists toolmanager_guard_attachments on public.%I', tab);
      execute format('create trigger toolmanager_guard_attachments after insert or update or delete on public.%I for each row execute function public.toolmanager_guard_attachment_manifest()', tab);
    end if;
  end loop;
end $$;

commit;
