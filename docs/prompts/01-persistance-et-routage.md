# L1 — Couche de persistance et routage

---

Tu travailles sur FocusDeck. Lis `CLAUDE.md`, `docs/prompts/README.md` et
`docs/cahier-des-charges.md` §6.1, §6.2, §6.4 et EF-X07.

**Objectif** : préparer l'arrivée de Supabase et de nouvelles pages **sans changement
visible pour l'utilisateur** ni perte de données.

**À faire**
1. Créer `src/data/` avec l'interface `FocusRepository` (§6.2, ajuste-la si le code
   réel l'exige et documente l'écart) et `LocalRepository` qui reprend exactement le
   stockage actuel (`focusdeck:v1:*`, sanitizers existants, sync multi-onglets via
   l'événement `storage`).
2. Un `RepositoryProvider` injecte l'implémentation ; `FocusContext` et `TimerContext`
   n'appellent plus `useLocalStorage` directement. Garder l'API publique des contextes
   (`useFocus`, `useTimer`) inchangée pour ne pas toucher aux composants.
3. Les méthodes sont asynchrones mais l'UI reste **optimiste** : l'état React est mis à
   jour immédiatement, l'écriture suit. Pas d'écran de chargement au démarrage en mode
   local (lecture synchrone initiale autorisée pour `LocalRepository`).
4. Ajouter `react-router` (mode data ou déclaratif, au choix justifié) avec les routes
   `/` (tableau de bord actuel), `/stats`, `/rapports`, `/reglages`. Les trois dernières
   affichent un état « bientôt disponible » propre, sauf `/reglages` qui réutilise le
   contenu de `SettingsDialog` en page. Navigation dans le `Header` (onglets animés,
   accessibles, version mobile en barre basse). Chargement paresseux des pages secondaires.
5. Prévoir `vercel.json` / fallback SPA pour que les URL profondes fonctionnent.
6. Tests : contrat de repository (une suite de tests générique exécutée contre
   `LocalRepository`, réutilisable plus tard contre `SyncedRepository`), migration nulle
   (données v1 existantes relues à l'identique), navigation e2e.

**Critères d'acceptation**
- Un utilisateur avec des données v0.1 ne voit aucune différence sur `/`.
- Plus aucun import de `useLocalStorage` hors de `src/data/`.
- Bundle initial dans le budget (pages secondaires en chunks séparés).
