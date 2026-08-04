# Mise en ligne de MoldFlow

## 1. Créer la base de données

- Créez un projet gratuit sur Supabase.
- Ouvrez **SQL Editor**.
- Copiez tout le contenu de `supabase-schema.sql`, puis cliquez sur **Run**.
- Dans **Authentication > Providers > Email**, activez la connexion par e-mail.

## 2. Relier MoldFlow à Supabase

Ouvrez `config.js` et renseignez :

```js
window.MOLDFLOW_CONFIG = {
  supabaseUrl: 'https://VOTRE-PROJET.supabase.co',
  supabaseKey: 'VOTRE_CLE_PUBLIQUE'
};
```

Utilisez exclusivement la clé publique `publishable` ou `anon`, jamais la clé secrète `service_role`.

## 3. Publier le site

Déposez les fichiers du dossier sur un hébergement statique HTTPS. Aucune compilation n'est nécessaire. La page d'accueil doit être `index.html`.

Après publication, ouvrez l'adresse du site depuis l'ordinateur de l'entreprise et le portable personnel. Créez un compte avec **Créer un compte**, puis utilisez le même compte sur les deux appareils.

## Fonctionnement des sauvegardes

- Chaque modification est d'abord enregistrée dans le navigateur.
- Si l'utilisateur est connecté, les données sont ensuite envoyées au cloud.
- À la connexion depuis un autre ordinateur, la dernière version cloud est chargée.
- En cas de coupure réseau, la copie locale reste disponible.
