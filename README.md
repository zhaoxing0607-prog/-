# MoldFlow · Gestion des moules

Prototype léger de gestion des projets de conception, installation, mise au point, maintenance des moules et achat de composants.

## Utilisation

Double-cliquez sur `index.html` ou démarrez un serveur de fichiers statiques dans ce dossier.

Cette version comprend : gestion des projets, parc de moules, pannes et réparations, achats de composants, rapports statistiques, recherche, filtres et sauvegarde locale dans le navigateur.

> Il s'agit d'un prototype monoposte. Pour un usage en équipe, ajoutez l'authentification, une base de données, le stockage des plans, un circuit de validation et des sauvegardes automatiques.

## Synchronisation entre plusieurs ordinateurs

1. Créez un projet sur [Supabase](https://supabase.com).
2. Dans **SQL Editor**, exécutez le fichier `supabase-schema.sql`.
3. Dans **Project Settings > API**, copiez l'URL du projet et la clé publique `publishable` (ou `anon`).
4. Collez ces deux valeurs dans `config.js`.
5. Publiez le dossier sur un hébergement statique HTTPS (Vercel, Cloudflare Pages ou serveur de l'entreprise).
6. Ouvrez la même adresse sur chaque ordinateur et connectez-vous avec le même compte.

Ne placez jamais la clé `service_role` dans `config.js`. Seule la clé publique est prévue pour le navigateur. Les règles RLS du fichier SQL limitent chaque utilisateur à ses propres données.

Sans configuration Supabase, l'application reste utilisable en mode local et continue à sauvegarder les données dans le navigateur.
