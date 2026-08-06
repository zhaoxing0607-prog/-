-- Expedit ToolManager · espace partagé et contrôle des rôles
-- Exécuter dans Supabase > SQL Editor avec un compte administrateur.

create table if not exists public.toolmanager_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.toolmanager_state (
  workspace_key text primary key default 'expedit',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Reprendre automatiquement les dernières données de l'ancien stockage s'il existe.
do $$
begin
  if to_regclass('public.moldflow_state') is not null then
    execute $migration$
      insert into public.toolmanager_state (workspace_key, data, updated_at)
      select 'expedit', data, updated_at
      from public.moldflow_state
      order by updated_at desc
      limit 1
      on conflict (workspace_key) do nothing
    $migration$;
  end if;
end $$;

insert into public.toolmanager_state (workspace_key)
values ('expedit')
on conflict (workspace_key) do nothing;

-- Le premier utilisateur Supabase existant devient administrateur.
insert into public.toolmanager_members (user_id, email, display_name, role)
select id, email, 'XING ZHAO', 'admin'
from auth.users
order by created_at
limit 1
on conflict (user_id) do update
set role = 'admin', active = true;

alter table public.toolmanager_members enable row level security;
alter table public.toolmanager_state enable row level security;

grant select on public.toolmanager_members to authenticated;
grant select, insert, update on public.toolmanager_state to authenticated;

drop policy if exists "members can read own role" on public.toolmanager_members;
create policy "members can read own role"
on public.toolmanager_members for select to authenticated
using ((select auth.uid()) = user_id and active = true);

drop policy if exists "authorized members can read workspace" on public.toolmanager_state;
create policy "authorized members can read workspace"
on public.toolmanager_state for select to authenticated
using (
  workspace_key = 'expedit'
  and exists (
    select 1 from public.toolmanager_members member
    where member.user_id = (select auth.uid()) and member.active = true
  )
);

drop policy if exists "admins can create workspace" on public.toolmanager_state;
create policy "admins can create workspace"
on public.toolmanager_state for insert to authenticated
with check (
  workspace_key = 'expedit'
  and exists (
    select 1 from public.toolmanager_members member
    where member.user_id = (select auth.uid())
      and member.active = true and member.role = 'admin'
  )
);

drop policy if exists "admins can update workspace" on public.toolmanager_state;
create policy "admins can update workspace"
on public.toolmanager_state for update to authenticated
using (
  workspace_key = 'expedit'
  and exists (
    select 1 from public.toolmanager_members member
    where member.user_id = (select auth.uid())
      and member.active = true and member.role = 'admin'
  )
)
with check (
  workspace_key = 'expedit'
  and exists (
    select 1 from public.toolmanager_members member
    where member.user_id = (select auth.uid())
      and member.active = true and member.role = 'admin'
  )
);

create index if not exists toolmanager_members_role_idx
on public.toolmanager_members (user_id, role, active);

-- Les demandes de panne sont installées par le script complémentaire
-- panne-ticket-schema.sql. Les viewers peuvent soumettre une demande, mais
-- seul un administrateur peut la valider ou la refuser.

-- Pour ajouter un collègue après son invitation, remplacer son adresse :
-- insert into public.toolmanager_members (user_id, email, display_name, role)
-- select id, email, 'Nom du collègue', 'viewer'
-- from auth.users where email = 'collegue@expedit.fr'
-- on conflict (user_id) do update set role = 'viewer', active = true;
