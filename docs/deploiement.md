# Déploiement et exploitation — FocusDeck

## Vue d'ensemble

| Élément | Valeur |
| --- | --- |
| Hébergeur | Vercel — projet `focusdeck`, équipe `noahdevelopment7-4318s-projects` |
| Production | https://focusdeck-one.vercel.app |
| Branche de production | `main` (à régler dans Vercel → Settings → Git → Production Branch) |
| Prévisualisations | une URL par branche et par PR, commentée automatiquement par Vercel |
| Configuration | `vercel.json` (fallback SPA, cache, en-têtes de sécurité) |
| Contrôles | GitHub Actions : `ci.yml` (qualité, e2e, Lighthouse) et `headers.yml` (audit hebdomadaire) |

## Mettre en ligne

1. Travailler sur une branche, ouvrir une PR vers `main`.
2. La CI doit être entièrement verte : typecheck, lint, couverture, build, budget de taille,
   e2e (Playwright + axe + CSP de production), Lighthouse (performance, accessibilité et
   bonnes pratiques ≥ 0,95 en mobile).
3. Vérifier la prévisualisation Vercel (lien dans le commentaire de la PR).
4. Fusionner dans `main` : Vercel déploie automatiquement en production (≈ 20 s).
5. Contrôler la production : `node scripts/security-headers.mjs https://focusdeck-one.vercel.app`
   (ou lancer le workflow « En-têtes de production » depuis l'onglet Actions).

## Revenir en arrière

Le déploiement précédent reste disponible, sans rebuild :

- **Tableau de bord Vercel** : Deployments → déploiement sain → ⋯ → *Instant Rollback*.
- **Ou via Git** : `git revert <commit>` sur une branche, PR, fusion. À privilégier dès que
  la cause est connue, pour que `main` reflète ce qui est en ligne.

Les données des utilisateurs sont dans leur navigateur (mode local) : un retour arrière du
code ne les touche pas, tant que le format de stockage reste compatible (voir la règle des
clés versionnées dans `CLAUDE.md`).

## Variables d'environnement

Référence complète : `.env.example`. Déclarer les valeurs dans Vercel → Settings →
Environment Variables, **séparément pour Preview et Production**.

| Variable | Portée | Rôle |
| --- | --- | --- |
| `VITE_SENTRY_DSN` | navigateur | Active le suivi d'erreurs. DSN public, sans danger côté client. |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | build | Envoi des source maps à Sentry, puis suppression du build (jamais publiées). |
| `VITE_VERCEL_ENV`, `VITE_VERCEL_GIT_COMMIT_SHA` | fournies par Vercel | Activation d'Analytics / Speed Insights, version Sentry. |

## Observabilité

- **Erreurs (Sentry)** : chargé à la demande après l'affichage, uniquement si
  `VITE_SENTRY_DSN` est défini. Aucune donnée personnelle : pas d'utilisateur, de cookies,
  d'en-têtes ni de corps de requête ; fils d'Ariane limités aux navigations et requêtes (URL
  réduites au chemin) ; e-mails masqués (`src/observability/privacy.ts`).
- **Audience (Vercel Analytics + Speed Insights)** : sans cookie, actifs seulement sur un
  déploiement Vercel, désactivables par l'utilisateur (Réglages → Confidentialité).
  Événements : `cycle_completed`, `report_exported` (puis `signed_up`, `upgraded_to_pro`).
  À activer une fois dans Vercel → Analytics et Speed Insights.
- **Performance** : Lighthouse CI à chaque PR. Le LCP mesuré en 4G lente simulée (≈ 2 s)
  reste au-dessus de l'objectif de 1,5 s (avertissement non bloquant) ; piste : réduire le
  bundle initial (Framer Motion en `LazyMotion`).

### Mettre en service Sentry

1. Créer un projet Sentry « React » (région UE recommandée : `*.ingest.de.sentry.io`).
2. Dans Vercel, ajouter `VITE_SENTRY_DSN` (Preview + Production) et, pour les source maps,
   `SENTRY_AUTH_TOKEN` (jeton d'organisation, portée `project:releases`), `SENTRY_ORG`,
   `SENTRY_PROJECT`.
3. Redéployer, puis vérifier sur une prévisualisation : dans la console du navigateur,
   `setTimeout(() => { throw new Error('test Sentry') })` doit apparaître dans Sentry sans
   donnée personnelle.

La CSP autorise déjà `https://*.ingest.sentry.io` et `https://*.ingest.de.sentry.io`.

## Rotation des clés

| Secret | Où | Procédure |
| --- | --- | --- |
| `SENTRY_AUTH_TOKEN` | Vercel (build) | Créer un nouveau jeton dans Sentry → remplacer dans Vercel → redéployer → révoquer l'ancien. |
| `VITE_SENTRY_DSN` | Vercel | Public par nature. En cas d'abus (spam d'événements) : nouvelle clé client dans Sentry → remplacer → redéployer → désactiver l'ancienne. |
| Clés Supabase / Stripe (lots L2, L6) | Vercel / Edge Functions | Même principe : créer, remplacer, redéployer, révoquer. Ne jamais exposer de clé secrète côté client. |

Après toute rotation, relancer le workflow « En-têtes de production » et vérifier qu'une
erreur de test remonte bien.
