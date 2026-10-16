# FocusDeck

Tableau de bord de productivité pour freelances et créateurs : minuteur Pomodoro
personnalisable, micro-objectifs du jour et rapport de fin de journée exportable
en Markdown ou PDF.

## Démarrage

```bash
npm install
npm run dev        # serveur de développement (http://localhost:5173)
npm run build      # vérification TypeScript + build de production
npm run preview    # sert le build
npm test           # tests unitaires et d'intégration (Vitest)
npm run lint       # ESLint (typescript-eslint strict + règles React Hooks)
```

## Fonctionnalités

- **Minuteur Pomodoro** — modes Focus / Pause courte / Pause longue, durées et
  intervalle de pause longue réglables, enchaînement automatique optionnel.
  Le temps restant est calculé à partir d'un horodatage de fin : pas de dérive,
  même quand l'onglet est en arrière-plan, et l'état survit à un rechargement.
  Alertes sonores (carillon synthétisé via Web Audio, sans fichier),
  visuelles (onde autour du cadran, bandeau, titre de l'onglet) et
  notifications navigateur optionnelles.
- **Micro-objectifs** — ajout, cochage animé, renommage (double-clic),
  suppression, filtres et réordonnancement par glisser-déposer.
- **Activité du jour** — cycles terminés, temps de focus et de pause, tâches
  complétées, frise des sessions.
- **Rapport de fin de journée** — aperçu, copie et export `.md` ou `.pdf`
  (jsPDF chargé à la demande).
- **Raccourcis clavier** — `Espace` démarrer/pause, `R` réinitialiser,
  `S` phase suivante, `1`/`2`/`3` changer de mode, `N` nouvel objectif,
  `,` réglages.

## Architecture

```
src/
├── components/
│   ├── Layout/     # AppShell, Header, fond d'ambiance, aide raccourcis
│   ├── Pomodoro/   # Cadran, contrôles, onglets de mode, réglages, alerte de fin
│   ├── Todo/       # TaskBoard, TaskInput, TaskItem
│   ├── Summary/    # Statistiques du jour, frise, boîte de dialogue du rapport
│   └── ui/         # Primitives : Button, Card, Modal, Toggle
├── context/
│   ├── FocusContext.tsx   # Réglages, tâches et journal des sessions (persistés)
│   └── TimerContext.tsx   # Moteur du minuteur (ticks, fin de phase, alertes)
├── hooks/          # useLocalStorage, useKeyboardShortcuts, useToday, useDocumentTitle
├── types/          # Interfaces TypeScript partagées
└── utils/          # Logique pure : transitions du minuteur, rapport Markdown/PDF,
                    # validation du stockage, formatage, son, notifications
```

La logique métier (transitions du minuteur, agrégation du rapport, validation)
vit dans des fonctions pures de `utils/`, testées indépendamment de React.
Les composants ne font que consommer les contextes.

### Persistance

Les données restent dans le `localStorage` du navigateur, sous des clés
versionnées (`focusdeck:v1:*`). Chaque lecture passe par un *sanitizer*
(`utils/validation.ts`) qui valide la structure et borne les valeurs : une
donnée corrompue ou modifiée à la main retombe sur des valeurs sûres au lieu de
casser l'application. Les titres de tâches sont normalisés et limités en
longueur, l'historique est conservé 30 jours, et les onglets ouverts se
synchronisent via l'événement `storage`. Le rapport Markdown est rendu en
éléments React (aucun HTML injecté).

Le hook `useLocalStorage` est la seule couche d'accès au stockage : un adaptateur
Supabase (authentification + PostgreSQL) pourra le remplacer sans toucher aux
composants.

## Stack

React 19 · TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
· Vite · Tailwind CSS v4 · Framer Motion · jsPDF · lucide-react · Vitest

## Feuille de route

- [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) — exigences, architecture cible, lots.
- [`docs/prompts/`](docs/prompts/README.md) — prompts de développement, un par lot.
- [`CLAUDE.md`](CLAUDE.md) — conventions et commandes pour les agents de code.
