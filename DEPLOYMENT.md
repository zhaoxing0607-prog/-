# Expedit ToolManager · mise en service

## 1. Configurer Supabase

1. Ouvrir le projet Supabase.
2. Aller dans **SQL Editor**.
3. Copier et exécuter entièrement `supabase-schema.sql`.
4. Vérifier dans **Table Editor** :
   - `toolmanager_members`
   - `toolmanager_state`
5. Vérifier que XING ZHAO possède le rôle `admin`.

Dans `config.js`, renseigner uniquement les valeurs publiques :

```js
window.MOLDFLOW_CONFIG = {
  supabaseUrl: 'https://VOTRE-PROJET.supabase.co',
  supabaseKey: 'VOTRE_CLE_PUBLISHABLE_OU_ANON',
  workspaceKey: 'expedit'
};
```

Ne jamais placer une clé `secret` ou `service_role` dans ce projet.

## 2. Inviter un lecteur

1. Dans Supabase, aller dans **Authentication > Users**.
2. Cliquer **Add user > Send invitation**.
3. Après la création du compte, exécuter dans **SQL Editor** :

```sql
insert into public.toolmanager_members (user_id, email, display_name, role)
select id, email, 'NOM DU COLLEGUE', 'viewer'
from auth.users
where email = 'collegue@expedit.fr'
on conflict (user_id) do update
set email = excluded.email,
    display_name = excluded.display_name,
    role = 'viewer',
    active = true;
```

Un `viewer` peut consulter, rechercher, naviguer entre les dashboards et exporter le rapport. Il ne peut pas écrire dans la base, même en appelant directement l'API.

## 3. Désactiver un accès

```sql
update public.toolmanager_members
set active = false
where email = 'collegue@expedit.fr';
```

## 4. Publier le site

Connecter le dépôt GitHub à Cloudflare Pages :

- Framework preset : `None`
- Build command : laisser vide
- Build output directory : `/`
- Branche de production : `main`

Après chaque `git push origin main`, Cloudflare Pages publiera automatiquement la nouvelle version.

## 5. Test obligatoire

1. Se connecter avec le compte administrateur : les boutons de modification doivent être visibles.
2. Se connecter avec un compte `viewer` : le badge `LECTURE SEULE` doit apparaître.
3. Vérifier que les boutons d'ajout, modification et suppression sont absents.
4. Vérifier qu'un `viewer` peut ouvrir les dashboards et exporter le rapport.
