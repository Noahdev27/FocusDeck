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
npm run build       # typecheck + build de production
```

Une modification n'est terminée que si `typecheck`, `lint`, `test` et `build` passent.
Pour toute modification visible, lancer l'app (`npm run build && npx vite preview`) et la
vérifier dans Chromium via Playwright (`/opt/node-tools/node_modules/playwright` dans
l'environnement cloud), en desktop 1360px et mobile 390px, sans erreur console et sans
défilement horizontal (`document.documentElement.scrollWidth === 390`).

## Architecture

```
src/
├── components/{Layout,Pomodoro,Todo,Summary,ui}/   # Présentation uniquement
├── context/FocusContext.tsx    # Réglages, tâches, journal des sessions (persistés)
├── context/TimerContext.tsx    # Moteur du minuteur : ticks, fin de phase, alertes
├── hooks/                      # useLocalStorage (seul accès au stockage), raccourcis, etc.
├── types/index.ts              # Types partagés
└── utils/                      # Logique pure et testée : timer, report, pdf, validation…
```

Règles :
- **La logique métier va dans des fonctions pures de `utils/`** (testées sans React).
  Les composants consomment les contextes et ne contiennent pas de règles métier.
- **Toute donnée lue d'une source externe** (localStorage, réseau, Supabase) passe par
  un sanitizer de `utils/validation.ts`. Jamais de `as MonType` sur un `JSON.parse`.
- Le minuteur dérive le temps restant de `endsAt` (horodatage de fin) — ne jamais
  décrémenter un compteur à chaque tick.
- Les transitions de phase (`completePhase`, `skipPhase`, `switchMode` dans
  `utils/timer.ts`) retournent `{ next, record }` ; le contexte applique l'état et
  historise. Toute nouvelle transition suit ce modèle.
- Clés de stockage versionnées `focusdeck:v1:*` (`utils/constants.ts`). Changer un
  format = incrémenter la version + écrire une migration testée.
- Animations : Framer Motion, `MotionConfig reducedMotion="user"` est actif.
  Pas d'animation qui bloque une interaction.
- Accessibilité : rôles ARIA corrects (switch, tab, dialog, checkbox, timer), focus
  visible, navigation clavier complète. Les modales passent par `components/ui/Modal`.
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
  `storageState`) pour le reste.
- `react-hooks` v7 interdit `Date.now()` et l'écriture de refs pendant le rendu :
  synchroniser les refs dans un `useEffect`.
- Une fonction `setState(updater)` peut s'exécuter plus tard : ne pas lire de valeur
  calculée dans l'updater juste après l'appel.
