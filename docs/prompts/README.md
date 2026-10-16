# Prompts de développement — FocusDeck

Un prompt par lot de la roadmap (`docs/cahier-des-charges.md` §7). Chaque prompt est
conçu pour **une session d'agent** et **une PR**. Copier-coller le contenu du fichier
(sous la ligne `---`) comme message à l'agent.

| Ordre | Fichier | Lot |
| --- | --- | --- |
| 1 | `00-socle-qualite.md` | L0 — CI, e2e, couverture, accessibilité |
| 2 | `01-persistance-et-routage.md` | L1 — repository + routes |
| 3 | `07-deploiement-observabilite.md` | L7 — mise en ligne, sécurité, Sentry |
| 4 | `02-supabase-auth-sync.md` | L2 — comptes, base, sync hors ligne |
| 5 | `04-taches-avancees.md` | L4 — projets, tâche active, estimations |
| 6 | `03-statistiques-rapports.md` | L3 — historique, stats, rapports de période |
| 7 | `05-pwa-theme-i18n.md` | L5 — PWA, notifications, thème, langues |
| 8 | `06-saas-stripe.md` | L6 — plans, paiement, landing |
| 9 | `08-rgpd-emails-integrations.md` | L8 — RGPD, e-mails, intégrations |

Modèles réutilisables : `modele-bug.md`, `modele-revue.md`, `modele-fonctionnalite.md`.

## Règles communes (s'appliquent à tous les prompts)

1. **Lire d'abord** `CLAUDE.md` puis les sections du cahier des charges citées par le prompt.
   Inspecter le code concerné avant de proposer un plan.
2. **Plan court avant le code** : lister les fichiers créés/modifiés et les exigences
   (IDs EF/ENF) couvertes. Si une décision ouverte (§11) bloque, poser la question et
   s'arrêter là ; sinon avancer avec le choix par défaut indiqué dans le prompt.
3. **Respecter l'architecture** : logique pure dans `utils/` ou `domain/` avec tests ;
   composants sans règle métier ; toute donnée externe validée par un sanitizer.
4. **Ne rien casser** : les données `localStorage` existantes des utilisateurs doivent
   être relues ou migrées (test de migration obligatoire si un format change).
5. **Vérifier avant de livrer** : `npm run typecheck && npm run lint && npm test && npm run build`,
   tests e2e, puis vérification visuelle desktop 1360 px et mobile 390 px sans erreur
   console. Rapporter honnêtement ce qui n'a pas pu être vérifié.
6. **Livrer** : commits clairs en français, push sur la branche de travail désignée.
   Ouvrir une PR seulement si l'utilisateur le demande ; sa description liste les IDs
   d'exigences, les captures et la checklist de la Definition of Done (§9).
7. **Mettre à jour la documentation** : §3 et tableaux d'exigences du cahier des charges
   (✅), `CLAUDE.md` si une règle ou une commande change.
8. **Ne jamais** committer de secret, désactiver un test pour obtenir du vert, ni créer
   de ressource payante (projet Supabase, produit Stripe, domaine) sans accord explicite.
