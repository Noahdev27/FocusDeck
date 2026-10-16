# Cahier des charges — FocusDeck

| | |
| --- | --- |
| Version du document | 1.0 — 16 octobre 2026 |
| État du produit | v0.1 (MVP local, branche `claude/stoic-davinci-3vr3su`) |
| Cible | v1.0 SaaS publique |

Les exigences sont numérotées pour être citées dans les prompts, commits et PR :
**EF** = exigence fonctionnelle, **ENF** = exigence non fonctionnelle. Priorité
MoSCoW : **M** (must), **S** (should), **C** (could), **W** (won't pour la v1).
La colonne « Lot » renvoie à la roadmap (§7) et aux prompts de `docs/prompts/`.

---

## 1. Vision

Un tableau de bord de productivité SaaS, ultra-fluide, pour freelances et créateurs :
on lance un cycle de concentration en une touche, on découpe sa journée en
micro-objectifs, et on termine par un rapport clair, partageable avec un client ou
gardé pour soi.

**Promesse** : « Ouvrez, concentrez-vous, prouvez ce que vous avez fait. »

**Principes produit**
1. *Zéro friction* — utilisable sans compte, en moins de 3 secondes après ouverture.
   Le compte n'apporte que la synchronisation et l'historique long.
2. *Hors ligne d'abord* — l'app fonctionne sans réseau ; le cloud est une réplique.
3. *Fluide mais sobre* — animations au service du retour d'information, jamais décoratives
   au point de ralentir.
4. *Vos données vous appartiennent* — export complet et suppression en un clic.

## 2. Utilisateurs cibles

| Persona | Besoin principal | Ce qui le fait rester |
| --- | --- | --- |
| **Léa, développeuse freelance** | Facturer au temps, justifier ses heures | Rapport PDF par client/projet, export du temps |
| **Karim, créateur de contenu** | Se protéger des distractions, tenir un rythme | Séries (streaks), statistiques hebdomadaires |
| **Sofia, designer en agence** | Découper des tâches floues | Micro-objectifs liés aux cycles, estimation en pomodoros |

Hors cible v1 : équipes avec gestion de droits, gestion de projet complète (pas de
Kanban, pas de Gantt).

## 3. État actuel (v0.1) — acquis

| Domaine | Livré |
| --- | --- |
| Minuteur | Modes Focus / Pause courte / Pause longue, durées et intervalle réglables, auto-enchaînement, calcul sans dérive via `endsAt`, persistance entre rechargements |
| Alertes | Carillon Web Audio, onde visuelle, bandeau, titre d'onglet, notifications navigateur (permission) |
| Tâches | CRUD, cochage animé, renommage, filtres, glisser-déposer, limite 200 tâches / 140 caractères |
| Rapport | Statistiques du jour, frise des sessions, aperçu Markdown, copie, export `.md` et `.pdf` (jsPDF chargé à la demande) |
| Hébergement | Cible Vercel : `vercel.json` prêt (SPA, cache, CSP stricte validée en navigateur, HSTS…) |
| Persistance | `localStorage` versionné (`focusdeck:v1:*`), validation de toutes les lectures, sync multi-onglets, rétention 30 jours |
| Qualité | TS strict, ESLint strict, 29 tests Vitest (logique pure + intégration), vérification Playwright manuelle |

Limites connues : pas de compte ni de sync multi-appareils ; historique limité au jour
courant dans l'interface ; notifications non fiables sur mobile (pas de Service
Worker) ; thème sombre uniquement ; français uniquement ; aucune CI ; pas déployé.

## 4. Exigences fonctionnelles

### 4.1 Minuteur Pomodoro

| ID | Exigence | Prio | Lot |
| --- | --- | --- | --- |
| EF-T01 | Les trois modes, durées réglables (bornes actuelles conservées) | M | ✅ |
| EF-T02 | Le minuteur survit au rechargement, à la mise en veille et à un onglet en arrière-plan sans dérive > 1 s | M | ✅ |
| EF-T03 | Une **tâche active** peut être associée au cycle Focus en cours ; la session enregistrée référence cette tâche | M | L4 |
| EF-T04 | Le minuteur est synchronisé entre appareils connectés (démarrer sur l'ordinateur, voir le décompte sur le téléphone) | S | L2 |
| EF-T05 | Sons au choix (3 carillons minimum + silencieux), volume, son d'ambiance optionnel (bruit brun) | C | L5 |
| EF-T06 | Mode « plein écran concentration » : cadran seul, tout le reste masqué | C | L4 |
| EF-T07 | Objectif quotidien de cycles (ex. 8) avec jauge | S | L3 |

### 4.2 Micro-objectifs

| ID | Exigence | Prio | Lot |
| --- | --- | --- | --- |
| EF-O01 | CRUD, cochage, renommage, filtres, réordonnancement | M | ✅ |
| EF-O02 | Estimation en pomodoros (1–8) et compteur de pomodoros réalisés par tâche | M | L4 |
| EF-O03 | **Projets** (nom, couleur, client optionnel) ; une tâche appartient à 0 ou 1 projet | M | L4 |
| EF-O04 | Étiquettes libres (max 5 par tâche) | C | L4 |
| EF-O05 | Report d'une tâche non terminée au lendemain (manuel + option automatique) | S | L4 |
| EF-O06 | Annuler une suppression (toast « Annuler » 5 s) | S | L4 |
| EF-O07 | Saisie rapide : `#projet` et `~3` (estimation) dans le titre sont interprétés | C | L4 |

### 4.3 Rapports et statistiques

| ID | Exigence | Prio | Lot |
| --- | --- | --- | --- |
| EF-R01 | Rapport du jour en Markdown et PDF | M | ✅ |
| EF-R02 | Rapport sur une **période** (jour, semaine, mois, plage libre), filtrable par projet | M | L3 |
| EF-R03 | Page Statistiques : temps de focus par jour (barres), carte de chaleur annuelle, série de jours consécutifs, répartition par projet | M | L3 |
| EF-R04 | Export CSV des sessions (date, début, fin, mode, durée, tâche, projet) | S | L3 |
| EF-R05 | PDF personnalisable : nom/logo du freelance, nom du client, mention libre | S | L6 |
| EF-R06 | Envoi automatique du rapport quotidien par e-mail à une heure choisie | C | L8 |
| EF-R07 | Lien de partage en lecture seule d'un rapport (expirable) | C | L8 |

### 4.4 Comptes et synchronisation

| ID | Exigence | Prio | Lot |
| --- | --- | --- | --- |
| EF-C01 | Utilisation complète **sans compte** (mode local) | M | ✅ |
| EF-C02 | Connexion par lien magique e-mail et Google OAuth (Supabase Auth) | M | L2 |
| EF-C03 | À la première connexion, les données locales sont **fusionnées** dans le compte (sans doublon, sans perte) | M | L2 |
| EF-C04 | Hors ligne : toutes les actions restent possibles, mises en file et synchronisées au retour du réseau | M | L2 |
| EF-C05 | Conflits : « dernier écrit gagne » par champ, horodaté serveur ; aucune perte silencieuse de tâche | M | L2 |
| EF-C06 | Déconnexion : choix « garder une copie locale » ou « effacer cet appareil » | S | L2 |
| EF-C07 | Suppression de compte et export complet JSON (RGPD) | M | L8 |

### 4.5 Expérience et plateforme

| ID | Exigence | Prio | Lot |
| --- | --- | --- | --- |
| EF-X01 | Raccourcis clavier documentés dans l'app | M | ✅ |
| EF-X02 | PWA installable (manifest, icônes, Service Worker, fonctionnement hors ligne) | M | L5 |
| EF-X03 | Notifications de fin de phase fiables via Service Worker (y compris Android) | S | L5 |
| EF-X04 | Thème clair, sombre, système | S | L5 |
| EF-X05 | Interface FR et EN, détection de la langue du navigateur | S | L5 |
| EF-X06 | Onboarding : 3 écrans max, sautable, rejouable depuis l'aide | C | L5 |
| EF-X07 | Navigation : Tableau de bord · Statistiques · Rapports · Réglages (routes URL) | M | L3 |

### 4.6 Offre SaaS

| ID | Exigence | Prio | Lot |
| --- | --- | --- | --- |
| EF-S01 | Plan **Gratuit** : tout le mode local + compte avec 30 jours d'historique, 3 projets | M | L6 |
| EF-S02 | Plan **Pro** (mensuel/annuel) : historique illimité, projets illimités, PDF personnalisé, rapports de période, export CSV | M | L6 |
| EF-S03 | Paiement Stripe Checkout + portail client Stripe ; statut d'abonnement mis à jour par webhook | M | L6 |
| EF-S04 | Contrôle des droits **côté serveur** (RLS / Edge Functions), le client ne fait qu'afficher | M | L6 |
| EF-S05 | Page d'accueil publique (landing) avec démo interactive du minuteur | S | L6 |
| EF-S06 | Essai Pro 14 jours sans carte | C | L6 |

### 4.7 Intégrations (après v1 sauf mention)

| ID | Exigence | Prio | Lot |
| --- | --- | --- | --- |
| EF-I01 | Export du rapport vers Notion (page) | C | L8 |
| EF-I02 | Statut Slack « En focus jusqu'à HH:MM » pendant un cycle | C | L8 |
| EF-I03 | Webhook sortant générique (fin de cycle, rapport) | W | — |

## 5. Exigences non fonctionnelles

### Performance (ENF-PERF)
- **PERF-1** Bundle JS initial ≤ 180 kB gzip (actuel ≈ 141 kB). jsPDF, Supabase
  realtime et les pages secondaires sont chargés à la demande.
- **PERF-2** Lighthouse mobile ≥ 95 en Performance, Accessibilité, Bonnes pratiques.
- **PERF-3** LCP < 1,5 s, INP < 100 ms, CLS < 0,05 sur un mobile moyen (4G).
- **PERF-4** Le tick du minuteur ne re-rend que les composants qui affichent le temps
  (séparer le contexte « temps restant » du contexte « actions » si nécessaire).

### Accessibilité (ENF-A11Y)
- **A11Y-1** WCAG 2.2 niveau AA. Contraste ≥ 4,5:1 pour le texte (vérifier les gris
  `zinc-500/600` sur fond sombre et clair).
- **A11Y-2** Toutes les actions accessibles au clavier ; focus visible ; pièges à focus
  dans les modales.
- **A11Y-3** Annonces lecteur d'écran : fin de phase (`role="status"`), pas
  d'annonce à chaque seconde.
- **A11Y-4** `prefers-reduced-motion` respecté partout.
- **A11Y-5** Tests automatisés axe-core dans la suite e2e, zéro violation sérieuse.

### Sécurité (ENF-SEC)
- **SEC-1** Row Level Security activée sur **toutes** les tables ; chaque politique
  testée (un utilisateur ne lit/écrit jamais les données d'un autre).
- **SEC-2** Aucun secret côté client hormis la clé publique (anon/publishable) Supabase.
  Clés Stripe secrètes et service role uniquement dans les Edge Functions.
- **SEC-3** En-têtes : CSP stricte (pas d'`unsafe-inline` pour les scripts), HSTS,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **SEC-4** Toute donnée entrante (stockage, réseau, Realtime) validée par un
  sanitizer ; tailles bornées (titres 140 car., 200 tâches actives, etc.).
- **SEC-5** Webhooks Stripe vérifiés par signature ; idempotence par `event.id`.
- **SEC-6** `npm audit` sans vulnérabilité haute ; dépendances mises à jour par Renovate/Dependabot.

### Qualité (ENF-QUAL)
- **QUAL-1** TypeScript strict actuel conservé ; zéro `any`, zéro `@ts-ignore`.
- **QUAL-2** Couverture ≥ 90 % sur `src/utils/**`, ≥ 70 % global.
- **QUAL-3** Tests e2e Playwright des parcours critiques (§8) exécutés en CI.
- **QUAL-4** CI GitHub Actions obligatoire sur chaque PR : typecheck, lint, tests, build,
  e2e, budget de taille.
- **QUAL-5** Migrations SQL versionnées dans `supabase/migrations/`, rejouables en local.

### Compatibilité (ENF-COMP)
- Deux dernières versions de Chrome, Edge, Firefox, Safari (macOS et iOS), Chrome Android.
- Largeur minimale 320 px, sans défilement horizontal.

### Données et conformité (ENF-RGPD)
- **RGPD-1** Hébergement des données dans l'UE (région Supabase `eu-west` / `eu-central`).
- **RGPD-2** Export complet et suppression de compte en libre-service (EF-C07).
- **RGPD-3** Pas de traceur publicitaire ; analytics sans cookie (Plausible ou Vercel Analytics) ;
  bandeau de consentement inutile tant que c'est le cas.
- **RGPD-4** Mentions légales, politique de confidentialité, CGU/CGV publiées avant le lancement payant.

### Observabilité (ENF-OBS)
- **OBS-1** Remontée d'erreurs front (Sentry ou équivalent) avec source maps privées,
  sans données personnelles (titres de tâches exclus).
- **OBS-2** Journal des erreurs des Edge Functions et alertes sur échec de webhook Stripe.

## 6. Architecture cible

### 6.1 Vue d'ensemble

```
Navigateur (React SPA / PWA)
 ├─ UI (components/)            → consomme uniquement les contextes
 ├─ Contextes (context/)        → état applicatif, appelle les repositories
 ├─ Domaine pur (utils/, domain/) → timer, rapports, stats, validation (testé)
 ├─ Repositories (data/)        → interface unique, 2 implémentations :
 │    ├─ LocalRepository   (localStorage, mode sans compte, cache hors ligne)
 │    └─ SyncedRepository  (LocalRepository + file d'attente + Supabase)
 └─ Service Worker              → cache des assets, notifications
          │ HTTPS (supabase-js)
Supabase (UE)
 ├─ Auth (lien magique, Google)
 ├─ Postgres + RLS              → profiles, settings, projects, tasks, sessions, subscriptions
 ├─ Realtime                    → état du minuteur multi-appareils
 └─ Edge Functions              → stripe-checkout, stripe-webhook, export-data, delete-account, daily-report
Stripe · Resend (e-mails) · Sentry · Vercel (hébergement statique + en-têtes)
```

### 6.2 Interface de persistance

Toute la persistance passe par une interface du type :

```ts
interface FocusRepository {
  loadSnapshot(): Promise<AppData>;              // settings, tasks, projects, sessions récentes
  saveSettings(settings: TimerSettings): Promise<void>;
  upsertTasks(tasks: Task[]): Promise<void>;
  deleteTask(id: string): Promise<void>;
  appendSession(session: SessionRecord): Promise<void>;
  listSessions(range: { from: string; to: string }): Promise<SessionRecord[]>;
  subscribe(onRemoteChange: (change: RemoteChange) => void): () => void;
}
```

Les contextes ne connaissent que cette interface (injectée par un provider).
Les identifiants restent des UUID générés côté client (déjà le cas), ce qui permet
l'écriture hors ligne sans collision.

### 6.3 Modèle de données (Postgres)

```sql
profiles      (id uuid pk = auth.users.id, display_name text, locale text, timezone text,
               plan text default 'free', created_at timestamptz)
settings      (user_id uuid pk fk, data jsonb not null, updated_at timestamptz)
projects      (id uuid pk, user_id uuid fk, name text check (length(name) <= 60),
               color text, client text, archived_at timestamptz, updated_at timestamptz)
tasks         (id uuid pk, user_id uuid fk, project_id uuid fk null, title text check (length(title) between 1 and 140),
               completed boolean, completed_at timestamptz, position double precision,
               estimate smallint check (estimate between 1 and 8), created_at timestamptz,
               updated_at timestamptz, deleted_at timestamptz)        -- suppression logique pour la sync
sessions      (id uuid pk, user_id uuid fk, task_id uuid fk null, mode text check (mode in ('focus','shortBreak','longBreak')),
               started_at timestamptz, ended_at timestamptz, duration_seconds int check (duration_seconds >= 0),
               completed boolean, day date not null)                  -- jour local de l'utilisateur
timer_states  (user_id uuid pk, snapshot jsonb, updated_at timestamptz)  -- EF-T04, diffusé via Realtime
subscriptions (user_id uuid pk, stripe_customer_id text, status text, price_id text,
               current_period_end timestamptz, updated_at timestamptz) -- écrit uniquement par le webhook
```

Index : `sessions (user_id, day)`, `tasks (user_id, updated_at)`.
RLS : `user_id = auth.uid()` en lecture/écriture sur toutes les tables, sauf
`subscriptions` (lecture seule pour l'utilisateur, écriture service role).
Les limites du plan Gratuit (EF-S01) sont appliquées par politique/trigger, pas par le client.

### 6.4 Synchronisation (EF-C03 à C05)

- Écriture locale immédiate (optimiste), puis ajout dans une file persistée
  (`focusdeck:v2:outbox`).
- Vidage de la file au retour du réseau et toutes les 30 s ; backoff exponentiel en cas d'erreur.
- Lecture incrémentale : `updated_at > dernier_curseur`.
- Conflits : dernier `updated_at` gagne, par enregistrement ; les suppressions sont logiques
  (`deleted_at`) pour se propager.
- Fusion initiale : les UUID locaux sont envoyés tels quels (`upsert`) ; les réglages
  locaux ne remplacent ceux du compte que si le compte n'en a pas.

### 6.5 Variables d'environnement

| Variable | Où | Usage |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client | URL du projet |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | clé publique |
| `VITE_SENTRY_DSN` | client | erreurs |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Edge Functions | paiement |
| `RESEND_API_KEY` | Edge Functions | e-mails |

Sans `VITE_SUPABASE_URL`, l'app fonctionne en mode local pur (EF-C01).

## 7. Roadmap par lots

Chaque lot = une branche, une PR, mergeable seul. Un prompt dédié existe dans
`docs/prompts/`.

| Lot | Contenu | Exigences | Dépend de | Prompt |
| --- | --- | --- | --- | --- |
| **L0** | Socle qualité : CI, e2e Playwright, couverture, axe-core | QUAL-2..4, A11Y-5 | — | `00-socle-qualite.md` |
| **L1** | Couche de persistance (repository) + routage, sans changement visible | §6.2, EF-X07 | L0 | `01-persistance-et-routage.md` |
| **L2** | Supabase : schéma, RLS, auth, sync hors ligne, minuteur multi-appareils | EF-C02..C06, EF-T04, SEC-1/2 | L1 | `02-supabase-auth-sync.md` |
| **L3** | Historique, statistiques, rapports de période, export CSV, objectif quotidien | EF-R02..R04, EF-T07 | L1 (L2 conseillé) | `03-statistiques-rapports.md` |
| **L4** | Tâches avancées : projets, tâche active, estimations, report, annulation | EF-O02..O07, EF-T03, EF-T06 | L1 | `04-taches-avancees.md` |
| **L5** | PWA, notifications SW, thème clair, i18n, sons, onboarding | EF-X02..X06, EF-T05 | L1 | `05-pwa-theme-i18n.md` |
| **L6** | SaaS : plans, Stripe, droits serveur, landing, PDF personnalisé | EF-S01..S06, EF-R05, SEC-5 | L2, L3 | `06-saas-stripe.md` |
| **L7** | Déploiement, en-têtes de sécurité, Sentry, Lighthouse CI | SEC-3, OBS-1/2, PERF-2/3 | L0 | `07-deploiement-observabilite.md` |
| **L8** | RGPD, e-mails, partage, intégrations | EF-C07, EF-R06/R07, EF-I01/I02, RGPD-* | L2 | `08-rgpd-emails-integrations.md` |

Ordre recommandé : L0 → L1 → L7 (mise en ligne tôt, en mode local) → L2 → L4 → L3 → L5 → L6 → L8.

## 8. Parcours critiques (tests e2e obligatoires)

1. Première visite → ajouter 3 objectifs → démarrer un Focus → fin de phase (horloge
   simulée) → passage en pause courte, alerte affichée, session enregistrée.
2. Rechargement en plein cycle → le décompte reprend à la bonne valeur.
3. Rapport : ouverture, export `.md` et `.pdf` (fichiers non vides, noms datés).
4. Réglages : changer la durée Focus → appliquée à la phase inactive.
5. Mobile 390 px : aucun défilement horizontal, toutes les actions atteignables.
6. *(L2)* Hors ligne → créer/cocher des tâches → retour réseau → données présentes sur un 2ᵉ appareil.
7. *(L2)* Utilisateur A ne voit jamais les données de B (test RLS).
8. *(L6)* Passage Pro via Stripe en mode test → fonctionnalités Pro débloquées après webhook.

## 9. Definition of Done (tout lot)

- [ ] Exigences du lot implémentées et citées (IDs) dans la description de PR.
- [ ] `typecheck`, `lint`, `test`, `build` verts ; couverture conforme à QUAL-2.
- [ ] Nouveaux parcours e2e ajoutés et verts ; parcours existants toujours verts.
- [ ] Vérification visuelle desktop + mobile, sans erreur console.
- [ ] Bundle initial dans le budget PERF-1.
- [ ] `CLAUDE.md` et ce cahier des charges mis à jour (§3 « État actuel », tableaux d'exigences ✅).
- [ ] Données existantes des utilisateurs migrées sans perte (si le format change).

## 10. Risques

| Risque | Impact | Parade |
| --- | --- | --- |
| Conflits de synchronisation perdant des tâches | Élevé | Suppression logique, tests de fusion, file persistée, pas de « remplacer tout » |
| Throttling des timers en arrière-plan (mobile) | Moyen | Calcul via `endsAt` (en place) + notification planifiée par le Service Worker |
| Contournement des limites du plan Gratuit | Moyen | Contrôles en RLS/trigger, jamais côté client |
| Poids du bundle (Framer Motion, Supabase) | Moyen | Imports à la demande, `LazyMotion`, budget en CI |
| Fuite de données personnelles via Sentry | Élevé | `beforeSend` qui retire titres de tâches et e-mails |

## 11. Décisions ouvertes (à trancher par le porteur du projet)

1. **Nom de domaine** et marque définitive (« FocusDeck » est-il disponible ?).
2. **Prix du plan Pro** (proposition : 4 €/mois, 36 €/an) et devise(s).
3. **Projet Supabase** : création par le porteur (recommandé, région UE) ou via les outils
   de l'agent avec son accord explicite. L'intégration Supabase de la marketplace Vercel peut
   injecter automatiquement les variables d'environnement.
4. ~~**Hébergeur**~~ — **tranché : Vercel** (16/10/2026). Configuration dans `vercel.json`
   (fallback SPA, cache des assets, en-têtes de sécurité dont une CSP stricte).
5. **Fournisseur d'analytics** : Vercel Analytics (recommandé, puisque l'hébergement est sur Vercel)
   ou Plausible (UE). Penser à ajouter son domaine à la CSP.
6. **Langue par défaut** de la landing : FR ou EN.

## 12. Glossaire

- **Cycle / Pomodoro** : une phase Focus menée à son terme.
- **Phase** : une période Focus, Pause courte ou Pause longue.
- **Session** : enregistrement historisé d'une phase (terminée ou interrompue ≥ 10 s).
- **Micro-objectif / tâche** : action courte de la journée.
- **Série (streak)** : nombre de jours consécutifs avec au moins un cycle terminé.
