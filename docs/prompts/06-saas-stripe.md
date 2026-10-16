# L6 — Offre SaaS : plans, Stripe, landing, PDF personnalisé

---

Tu travailles sur FocusDeck. Lis `CLAUDE.md`, `docs/prompts/README.md` et
`docs/cahier-des-charges.md` §4.6, EF-R05, §5 (SEC-2, SEC-5, RGPD-4), §6.3
(`subscriptions`), §11 (décisions ouvertes). L2 et L3 doivent être mergés.

**Préalable — demander à l'utilisateur et attendre la réponse**
- Prix et périodicités (proposition par défaut : 4 €/mois, 36 €/an), devise, essai 14 j ?
- Compte Stripe : travailler **uniquement en mode test** tant que l'utilisateur n'a pas
  explicitement demandé la production. Ne créer aucun produit Stripe sans accord.

**À faire**
1. Droits : fonction SQL `has_pro(user_id)` ; limites du plan Gratuit (30 jours
   d'historique consultable via le compte, 3 projets) appliquées par RLS/trigger
   (EF-S04). Tests SQL. Le mode local sans compte reste illimité (c'est volontaire).
2. Edge Functions : `create-checkout-session`, `create-portal-session`, `stripe-webhook`
   (signature vérifiée, idempotence par `event.id`, mise à jour de `subscriptions`).
   Tests avec des événements Stripe enregistrés (fixtures).
3. Client : page `/abonnement` (comparatif des plans, statut, gestion via le portail),
   badges « Pro » sur les fonctionnalités verrouillées avec explication, jamais de
   blocage brutal en plein cycle.
4. PDF personnalisé (EF-R05) : nom, logo (image redimensionnée côté client, ≤ 200 Ko),
   client, mention libre ; réservé Pro.
5. Landing publique (EF-S05) sur `/` pour les visiteurs non connectés qui n'ont jamais
   utilisé l'app (sinon tableau de bord direct) : proposition de valeur, démo interactive
   du minuteur, tarifs, FAQ, liens légaux. Pré-rendue ou très légère (LCP < 1,5 s).
6. Pages légales (mentions, confidentialité, CGU/CGV) avec contenus **marqués à
   compléter par le porteur** — ne pas inventer d'informations juridiques.
7. e2e parcours 8 avec Stripe en mode test (carte 4242…), webhook simulé en CI.

**Critères d'acceptation**
- Impossible d'obtenir une fonctionnalité Pro en modifiant le client (tests RLS).
- Annulation dans le portail → retour au plan Gratuit à la fin de période, sans perte de données.
