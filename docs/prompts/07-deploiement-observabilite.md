# L7 — Déploiement, sécurité HTTP, observabilité

---

Tu travailles sur FocusDeck. Lis `CLAUDE.md`, `docs/prompts/README.md` et
`docs/cahier-des-charges.md` §5 (SEC-3, OBS-1/2, PERF-2/3, RGPD-3), §6.5, §11.

**Hébergeur : Vercel (décision prise).** `vercel.json` existe déjà avec le fallback SPA, le
cache des assets et les en-têtes de sécurité ; pars de ce fichier. Utilise les outils MCP
Vercel s'ils sont disponibles, sinon la CLI `vercel`. Demande avant de créer le projet
Vercel, d'ajouter un domaine ou de promouvoir en production ; les déploiements de
prévisualisation sur la branche de travail sont autorisés une fois le projet créé.

**À faire**
1. Projet Vercel relié au dépôt GitHub (preset Vite, Node 22) : preview par PR,
   production sur `main`. Vérifier `vercel.json` (ajouter `no-cache` sur le Service Worker
   quand il existera).
2. En-têtes de sécurité (SEC-3) : la CSP de `vercel.json` est volontairement minimale
   (`'self'` uniquement). Y ajouter **exactement** les domaines nécessaires à Supabase
   (`connect-src` https + wss), Stripe, Sentry et l'analytics. Vérifier en preview qu'aucun
   événement `securitypolicyviolation` ne survient (voir le piège CSP dans `CLAUDE.md`).
3. Sentry (ou équivalent) chargé à la demande, `beforeSend` qui supprime titres de tâches,
   noms de projets et e-mails (OBS-1) ; source maps envoyées en CI, non publiées.
4. Vercel Analytics / Speed Insights sans cookie (RGPD-3), désactivables, événements : cycle terminé, rapport
   exporté, inscription, passage Pro. Aucune donnée personnelle.
5. Lighthouse CI dans GitHub Actions avec les seuils PERF-2 sur l'URL de prévisualisation.
6. Variables d'environnement déclarées dans Vercel (Preview et Production séparées) ;
   `.env.example` à jour.
7. Documenter dans `docs/deploiement.md` : mise en ligne, retour arrière, rotation des clés.

**Critères d'acceptation**
- securityheaders.com (ou test équivalent scripté) : note A minimum.
- Une erreur volontaire en preview remonte dans Sentry sans donnée personnelle.
