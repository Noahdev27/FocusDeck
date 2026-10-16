# L7 — Déploiement, sécurité HTTP, observabilité

---

Tu travailles sur FocusDeck. Lis `CLAUDE.md`, `docs/prompts/README.md` et
`docs/cahier-des-charges.md` §5 (SEC-3, OBS-1/2, PERF-2/3, RGPD-3), §6.5, §11.

**Préalable** : confirmer l'hébergeur (Vercel par défaut) et qui crée le projet. Ne
crée ni projet ni domaine sans accord explicite ; tu peux préparer toute la configuration.

**À faire**
1. Configuration d'hébergement (`vercel.json` ou équivalent) : fallback SPA, cache long
   immuable sur `/assets/*`, pas de cache sur `index.html` et le Service Worker.
2. En-têtes de sécurité (SEC-3) : CSP stricte compatible avec Vite, Supabase, Stripe et
   Sentry (lister les domaines), HSTS, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
   `Permissions-Policy` minimale. Vérifier qu'aucune erreur CSP n'apparaît en console.
3. Sentry (ou équivalent) chargé à la demande, `beforeSend` qui supprime titres de tâches,
   noms de projets et e-mails (OBS-1) ; source maps envoyées en CI, non publiées.
4. Analytics sans cookie (RGPD-3), désactivables, événements : cycle terminé, rapport
   exporté, inscription, passage Pro. Aucune donnée personnelle.
5. Lighthouse CI dans GitHub Actions avec les seuils PERF-2 sur l'URL de prévisualisation.
6. Environnements : preview par PR, production sur `main` ; `.env.example` à jour.
7. Documenter dans `docs/deploiement.md` : mise en ligne, retour arrière, rotation des clés.

**Critères d'acceptation**
- securityheaders.com (ou test équivalent scripté) : note A minimum.
- Une erreur volontaire en preview remonte dans Sentry sans donnée personnelle.
