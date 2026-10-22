# FocusDeck — mémoire du projet

Tableau de bord de productivité (Pomodoro + micro-objectifs + rapport de fin de journée)
pour freelances et créateurs. Interface **en français**, code et identifiants en anglais,
commentaires en français.

Documents de référence (à lire avant tout travail significatif) :
- `docs/cahier-des-charges.md` — exigences numérotées (EF-xx / ENF-xx), architecture cible, roadmap.
- `docs/prompts/` — un prompt par lot de travail, à exécuter dans l'ordre indiqué.

## Commandes

```bash
npm run dev         # Vite, http://localhost:5173
npm run typecheck   # tsc -b (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)
npm run lint        # ESLint (typescript-eslint strict + react-hooks v7)
npm test            # Vitest (jsdom)
npm run coverage    # Vitest + couverture avec seuils (global 70 %, src/utils 90 %)
npm run build       # typecheck + build de production
npm run size        # budget JS initial ≤ 180 kB gzip (après build)
npm run check       # typecheck + lint + coverage + build + size
npm run e2e         # Playwright (après build) : parcours critiques, axe, CSP de vercel.json
```

La CI exécute aussi **Lighthouse** (mobile, ≥ 0,95 en performance, accessibilité et bonnes
pratiques) via `npx @lhci/cli` — outil volontairement non installé dans le projet
(dépendances vulnérables). En local : `CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx -y @lhci/cli@0.15.1 autorun` après `npm run build`.
Déploiement, retour arrière et rotation des clés : `docs/deploiement.md`.

Une modification n'est terminée que si `npm run check` et `npm run e2e` passent ; la CI
GitHub Actions (`.github/workflows/ci.yml`) les exécute sur chaque PR et sur `main`.
Les tests e2e appliquent les en-têtes de `vercel.json` et échouent sur toute erreur console,
violation CSP ou violation axe sérieuse/critique (WCAG 2.2 AA).

`@playwright/test` et `playwright-core` sont **épinglés en 1.56.1** pour correspondre au
Chromium préinstallé de l'environnement cloud (`/opt/pw-browsers/chromium-1194`). Ne pas les
mettre à jour sans mettre à jour ce navigateur ; ne jamais lancer `playwright install` en local
cloud (la CI, elle, l'installe).
Pour toute modification visible, lancer l'app (`npm run build && npx vite preview`) et la
vérifier dans Chromium via Playwright (`/opt/node-tools/node_modules/playwright` dans
l'environnement cloud), en desktop 1360px et mobile 390px, sans erreur console et sans
défilement horizontal (`document.documentElement.scrollWidth === 390`).

## Architecture

```
src/
├── App.tsx                     # Providers + routes (react-router, mode déclaratif)
├── routes.ts                   # Liens de navigation + chargeurs paresseux des pages
├── pages/                      # Une page par route (/, /stats, /rapports, /reglages, 404)
├── components/{Layout,Pomodoro,Todo,Summary,ui}/   # Présentation uniquement
├── context/FocusContext.tsx    # Réglages, tâches, projets, journal des sessions (persistés)
├── context/TimerContext.tsx    # Moteur du minuteur : ticks, fin de phase, alertes
├── data/                       # SEUL accès à la persistance : FocusRepository,
│                               # LocalRepository, RepositoryProvider, usePersistentState,
│                               # migrations.ts (stockage v1 → v2, exécutée une fois)
│   ├── sync/                   # SyncedRepository (file, fusion, curseur), serveur mémoire de test
│   └── supabase/               # RemoteStore Supabase (lecture incrémentale, Realtime)
├── auth/                       # Supabase Auth (lien magique, Google), chargé à la demande
├── observability/              # Sentry (erreurs) et Vercel Analytics, chargés à la demande ;
│                               # privacy.ts filtre toute donnée personnelle avant envoi
├── hooks/                      # Raccourcis clavier, jour courant, titre du document
├── types/index.ts              # Types partagés
└── utils/                      # Logique pure et testée : timer, logs, report, pdf, validation,
                                # tasks (report, annulation, pomodoros), projects, quickEntry…
```

Règles :
- **La logique métier va dans des fonctions pures de `utils/`** (testées sans React).
  Les composants consomment les contextes et ne contiennent pas de règles métier.
- **Persistance** : les contextes passent par `usePersistentState(clé)` (`src/data/`), jamais
  par `localStorage` directement. Toute nouvelle implémentation de `FocusRepository`
  (Supabase au lot L2) doit passer `describeRepositoryContract` (`src/data/repositoryContract.ts`).
- **Synchronisation** (lot L2, `docs/supabase.md`) : lecture toujours depuis le cache local ;
  le `SyncedRepository` calcule le différentiel et le met en file. Ne jamais écrire en base
  depuis un composant. Comparer des données avec `deepEqual` (`utils/equal.ts`), jamais
  `JSON.stringify` (sensible à l'ordre des clés). Les sessions ont un identifiant
  déterministe `mode:début` (`sessionIdFor`) pour être dédoublonnées entre appareils.
- **Base de données** : toute évolution du schéma = nouvelle migration dans
  `supabase/migrations/` + tests dans `supabase/tests/` (PGlite, vrai Postgres). RLS
  obligatoire sur chaque table, avec un test « B ne voit pas les données de A ».
- **Pages** : chaque page secondaire est chargée paresseusement (`routes.ts`) ; le minuteur
  vit au-dessus du routeur et continue de tourner d'une page à l'autre.
- **Toute donnée lue d'une source externe** (localStorage, réseau, Supabase) passe par
  un sanitizer de `utils/validation.ts`. Jamais de `as MonType` sur un `JSON.parse`.
- Le minuteur dérive le temps restant de `endsAt` (horodatage de fin) — ne jamais
  décrémenter un compteur à chaque tick.
- Les transitions de phase (`completePhase`, `skipPhase`, `switchMode` dans
  `utils/timer.ts`) retournent `{ next, record }` ; le contexte applique l'état et
  historise. Toute nouvelle transition suit ce modèle.
- Clés de stockage versionnées `focusdeck:v2:*` (`utils/constants.ts`, v2 depuis le lot L4).
  Changer un format = incrémenter la version + étendre `data/migrations.ts` (marqueur
  `focusdeck:vN:migrated`, anciennes clés conservées pour un retour arrière) + test avec des
  données réelles de la version précédente (`data/migrations.test.ts`). Un champ ajouté à un
  type persisté doit avoir une valeur neutre dans son sanitizer (données anciennes).
- **Projets, tâche active, pomodoros (L4)** : la tâche active vit dans `TimerSnapshot.taskId`
  (synchronisée, conservée d'une phase à l'autre) ; seules les sessions Focus portent `taskId`.
  Le nombre de pomodoros d'une tâche est **dérivé** du journal (`countPomodoros`), jamais
  stocké. Un projet ne se supprime pas, il s'archive. `tasks.project_id` / `sessions.task_id`
  n'ont pas de clé étrangère en base (une référence orpheline bloquerait la file de sync).
- **Suppression annulable** : `deleteTask`/`clearCompletedTasks` renvoient les tâches retirées
  avec leur position ; les passer à `restoreTasks` depuis l'action « Annuler » d'un toast
  (`components/ui/Toast`, `useToast().show(...)`). `focusAction: true` quand l'action vient
  du clavier (`event.detail === 0`) : le bouton activé a disparu, le focus va sur « Annuler ».
- Animations : Framer Motion, `MotionConfig reducedMotion="user"` est actif.
  Pas d'animation qui bloque une interaction. **Ne jamais animer en JavaScript la couleur,
  le flou ou la taille de grands éléments floutés** (fond, halos) : empiler des calques et ne
  faire varier que `opacity`/`transform` en CSS. Sinon le temps de blocage mobile explose
  (2,2 s mesurées, contre 0,1 s après correction).
- Observabilité : `reportError(erreur)` et `trackEvent({ name, properties })`
  (`src/observability`) ; jamais de donnée personnelle (titre de tâche, e-mail…) dans les
  propriétés d'un événement.
- Contraste : texte secondaire en `text-zinc-400` minimum sur fond sombre (`zinc-500/600`
  échouent au contraste AA).
- Accessibilité : rôles ARIA corrects (switch, tab, dialog, checkbox, timer), focus
  visible, navigation clavier complète. Les modales passent par `components/ui/Modal` ; seule
  exception, le mode concentration (`Pomodoro/FocusMode`) : vue plein écran qui rend le reste
  de l'application `inert`. Aucun élément `role="status"` permanent (les tests e2e ciblent
  l'unique `getByRole('status')` de fin de phase) : la région des toasts utilise `aria-live`.
- Pas de `dangerouslySetInnerHTML`. Le rendu Markdown passe par `MarkdownPreview`.
- Pas de nouvelle dépendance sans justification (taille du bundle : budget dans le
  cahier des charges, ENF-PERF).

## Commits

- Auteur des commits : **noahdev** `<ngandeu.noe27@gmail.com>`. Dans tout nouveau clone :
  `git config user.name "noahdev"`, `git config user.email "ngandeu.noe27@gmail.com"`,
  `git config commit.gpgsign false`.
- **Aucune** ligne `Co-Authored-By: Claude…` ni `Claude-Session:` dans les messages de commit,
  et aucune mention de Claude dans les descriptions de PR. Messages en français.

## Hébergement

Vercel — projet `focusdeck` (`prj_PanNZm4STdn6PrqYc579nOkxf39t`, équipe
`team_un5W8MqEmYvoJEtF7vg5DFmN`), production : https://focusdeck-one.vercel.app.
Chaque push déclenche un déploiement. Branche de production actuelle :
`claude/stoic-davinci-3vr3su` (à basculer sur `main` dans Settings → Git dès que `main`
existe). Le réseau de l'environnement cloud bloque `*.vercel.app` : vérifier un déploiement
avec l'outil MCP `web_fetch_vercel_url`. `vercel.json` définit le fallback SPA, le cache des assets et les
en-têtes de sécurité. **Tout nouveau domaine externe** (API, CDN, analytics, Supabase,
Stripe…) doit être ajouté à la directive CSP correspondante de `vercel.json`, sinon il sera
bloqué en production alors qu'il marche avec `vite dev`.

## Pièges connus

- CSP : `style-src` autorise le hash `sha256-47DEQ…` (chaîne vide). Framer Motion
  (`AnimatePresence mode="popLayout"`) insère un `<style>` vide puis ajoute ses règles via
  `insertRule` ; sans ce hash, l'animation de suppression des tâches casse. Ne pas ajouter
  `'unsafe-inline'`. Pour tester la CSP en local, injecter les en-têtes de `vercel.json`
  via `context.route` dans Playwright (`vite preview` ne les applique pas).

- Les tests Playwright avec `page.clock.install()` figent `requestAnimationFrame` pour
  **tout le contexte** : les animations de sortie (modales) ne se terminent pas. Utiliser
  `clock.fastForward` pour le minuteur, puis un **nouveau contexte** (avec
  `storageState`) pour le reste : `openCheckedPage(browser, options)` de `e2e/fixtures.ts`
  applique les mêmes en-têtes et contrôles (console, CSP) que la fixture `page`
  (exemple : `e2e/tasks.spec.ts`).
- Dates de test : l'e2e tourne en `Europe/Paris` ; un script Node qui prépare des données
  doit calculer le jour dans ce fuseau (sinon, vers minuit, « demain » devient « aujourd'hui »).
- `react-hooks` v7 interdit `Date.now()` et l'écriture de refs pendant le rendu :
  synchroniser les refs dans un `useEffect`.
- Réentrance : une fonction asynchrone qui marque « en cours » APRÈS avoir lancé son travail
  peut être rappelée de façon synchrone avant le marquage (récursion infinie constatée dans
  `syncNow`). Marquer d'abord, puis céder un tour (`await Promise.resolve()`) avant de travailler.
- Les tests sous `supabase/tests/` tournent dans l'environnement Node (`// @vitest-environment node`).
- Une fonction `setState(updater)` peut s'exécuter plus tard : ne pas lire de valeur
  calculée dans l'updater juste après l'appel.
