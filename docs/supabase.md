# Comptes et synchronisation (Supabase) — FocusDeck

État : **tout le code du lot L2 est en place et testé, mais aucun projet Supabase n'est
branché.** Sans les variables `VITE_SUPABASE_*`, l'application reste en mode local pur :
pas de bouton de connexion, aucune requête réseau, `supabase-js` jamais chargé.

## Ce qui est livré

| Élément | Fichier | Tests |
| --- | --- | --- |
| Schéma, contraintes, RLS, triggers | `supabase/migrations/20261017000000_init.sql` | `supabase/tests/rls.test.ts` (vrai Postgres via PGlite) |
| Projets, jour prévu, références sans clé étrangère (L4) | `supabase/migrations/20261021000000_l4_projects.sql` | idem |
| File d'attente, différentiel, fusion | `src/data/sync/outbox.ts`, `merge.ts` | `outbox.test.ts` |
| Dépôt synchronisé (hors ligne d'abord) | `src/data/sync/syncedRepository.ts` | suite de contrat + scénarios multi-appareils |
| Accès Supabase (lecture incrémentale, Realtime) | `src/data/supabase/supabaseRemote.ts` | `supabaseRemote.test.ts` (client simulé) |
| Authentification (lien magique, Google) | `src/auth/` | `src/components/Account/account.test.tsx` |
| Interface (connexion, compte, statut) | `src/components/Account/` | idem |

### Fonctionnement

- **Lecture** : toujours depuis le cache local (`localStorage`), l'application démarre sans
  attendre le réseau.
- **Écriture** : immédiate en local ; le différentiel (tâches ajoutées/modifiées/supprimées,
  nouvelles sessions, réglages, minuteur) part dans une file persistée
  (`focusdeck:v2:sync:<utilisateur>:outbox`).
- **Envoi** : à chaque écriture, au retour du réseau, toutes les 30 s et sur notification
  Realtime. Échec → nouvel essai à 1 s, 2 s, 4 s… plafonné à 60 s.
- **Réception** : lecture incrémentale par curseur `updated_at` (horodatage serveur), avec
  5 s de marge ; la fusion est idempotente.
- **Conflits** : une modification locale en attente l'emporte jusqu'à son envoi ; ensuite le
  serveur arbitre (dernier écrit gagne). Les suppressions sont logiques (`deleted_at`).
- **Première connexion** : ce qui n'existe que sur l'appareil est envoyé ; les réglages du
  compte, s'ils existent, priment. Les identifiants étant des UUID, une reconnexion ne
  crée aucun doublon.
- **Minuteur multi-appareils** : l'état du minuteur est partagé ; une phase terminée sur
  deux appareils produit le même identifiant de session (`mode:début`), donc une seule ligne.
- **Déconnexion** : « Garder une copie » (on continue sans compte) ou « Effacer les données
  de cet appareil » (rien n'est supprimé du compte).

## Mise en service (≈ 15 minutes)

1. **Créer le projet** sur https://supabase.com — région **Europe (Paris, `eu-west-3`)**
   (RGPD-1). L'offre gratuite suffit pour démarrer (2 projets actifs maximum par
   organisation).
2. **Appliquer le schéma** : SQL Editor → coller le contenu de chaque fichier de
   `supabase/migrations/`, **dans l'ordre des noms** (`20261017…_init.sql` puis
   `20261021…_l4_projects.sql`) → Run.
   Ou, avec la CLI : `supabase link --project-ref <ref>` puis `supabase db push`.
3. **Authentification** (Authentication → Providers / URL Configuration) :
   - *Email* : activé (lien magique).
   - *Google* : créer un identifiant OAuth dans Google Cloud, renseigner Client ID / Secret.
   - *Site URL* : `https://focusdeck-one.vercel.app` ; *Redirect URLs* : ajouter aussi
     `https://*-noahdevelopment7-4318s-projects.vercel.app/**` (prévisualisations) et
     `http://localhost:5173`.
4. **Realtime** : vérifier dans Database → Replication que `settings`, `projects`, `tasks`,
   `sessions` et `timer_states` sont publiées (la migration le fait si la publication existe).
5. **Variables Vercel** (Settings → Environment Variables, Preview et Production) :
   - `VITE_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = clé publique (*publishable* / *anon*).
   La clé `service_role` ne doit **jamais** être exposée côté client (SEC-2).
6. **Redéployer** puis tester : se connecter sur deux navigateurs, créer une tâche sur l'un,
   la voir apparaître sur l'autre ; couper le réseau, cocher des tâches, rétablir.

La CSP de `vercel.json` autorise déjà `https://*.supabase.co` et `wss://*.supabase.co`.

## Tests de sécurité

`supabase/tests/rls.test.ts` exécute les migrations réelles dans PGlite (Postgres compilé en
WebAssembly) avec un environnement Supabase minimal (`auth.uid()`, rôles, droits par
défaut), puis vérifie qu'un utilisateur ne lit ni n'écrit jamais les données d'un autre,
qu'un anonyme n'a accès à rien, que le plan Pro ne peut pas être modifié par l'utilisateur
et que les contraintes (longueurs, modes, 200 tâches) tiennent. Ils tournent en CI avec le
reste de la suite (`npm test`).

## Limites connues

- Pas encore d'écran « mot de passe » : connexion par lien magique ou Google uniquement.
- L'ordre des tâches est synchronisé par position ; deux réorganisations simultanées sur
  deux appareils se résolvent en « dernier écrit gagne ».
- Les types TypeScript de la base sont écrits à la main (`supabaseRemote.ts`) ; à
  régénérer avec `supabase gen types typescript` une fois le projet créé.
