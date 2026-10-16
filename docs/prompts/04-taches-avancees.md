# L4 — Tâches avancées : projets, tâche active, estimations

---

Tu travailles sur FocusDeck. Lis `CLAUDE.md`, `docs/prompts/README.md` et
`docs/cahier-des-charges.md` §4.1 (EF-T03, EF-T06), §4.2, §6.3 (tables `projects`,
`tasks`, `sessions.task_id`).

**À faire**
1. Types et sanitizers : `Project`, champs `projectId`, `estimate`, `position`,
   `deletedAt` sur `Task`, `taskId` sur `SessionRecord`. **Migration v1 → v2** du stockage
   local, testée avec des données v0.1 réelles (copier un échantillon dans les tests).
2. Projets (EF-O03) : création/édition/archivage, couleur parmi une palette accessible,
   client optionnel. Sélecteur de projet sur chaque tâche ; filtre par projet.
3. Tâche active (EF-T03) : « Lancer un focus sur cette tâche » depuis une tâche ; la tâche
   apparaît sous le cadran ; la session enregistrée porte `taskId` ; compteur de
   pomodoros réalisés vs estimation sur la tâche (EF-O02), avec retour visuel quand
   l'estimation est dépassée.
4. Report au lendemain (EF-O05) et annulation de suppression par toast 5 s (EF-O06).
   Créer un composant `Toast` générique réutilisable.
5. Saisie rapide (EF-O07) : `#projet` et `~3` analysés par une fonction pure testée ;
   aperçu des jetons reconnus pendant la saisie.
6. Mode plein écran concentration (EF-T06) : touche `F`, `Échap` pour sortir, API
   Fullscreen si disponible.
7. Le rapport (jour et période) groupe les tâches par projet et affiche le temps par projet.
8. Si `SyncedRepository` existe (L2), étendre le schéma SQL par migration et la sync.

**Critères d'acceptation**
- Un utilisateur v0.1 retrouve toutes ses tâches après migration.
- Navigation clavier complète (sélecteur de projet, toast, plein écran).
- Tests e2e : créer un projet, lancer un focus sur une tâche, terminer le cycle, vérifier
  le compteur et le rapport groupé.
