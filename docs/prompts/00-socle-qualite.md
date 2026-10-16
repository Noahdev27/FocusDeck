# L0 — Socle qualité

---

Tu travailles sur FocusDeck. Lis `CLAUDE.md`, `docs/prompts/README.md` (règles communes)
et `docs/cahier-des-charges.md` §5 (ENF-QUAL, ENF-A11Y, ENF-PERF) et §8.

**Objectif** : rendre chaque future modification vérifiable automatiquement. Aucun
changement de comportement visible.

**À faire**
1. Ajouter `@testing-library/jest-dom` et `@vitest/coverage-v8`. Configurer la couverture
   avec les seuils QUAL-2 (≥ 90 % sur `src/utils/**`, ≥ 70 % global) ; ajouter les tests
   manquants pour atteindre ces seuils plutôt que baisser les seuils.
2. Mettre en place Playwright (`@playwright/test`, dossier `e2e/`, config qui lance
   `vite preview`). Si la version installée ne trouve pas son navigateur, utiliser
   `executablePath: '/opt/pw-browsers/chromium'` en local cloud et le navigateur par
   défaut en CI. Ne jamais lancer `playwright install` dans l'environnement cloud.
3. Écrire les parcours critiques 1 à 5 du §8. Pour le minuteur, `page.clock.install()`
   + `clock.fastForward()` ; attention, l'horloge simulée fige `requestAnimationFrame`
   pour tout le contexte (voir `CLAUDE.md`, pièges connus).
4. Ajouter `@axe-core/playwright` : zéro violation `serious`/`critical` sur la page
   principale et chaque modale ouverte. Corriger les contrastes insuffisants trouvés.
5. Script `npm run size` qui échoue si le JS initial gzip dépasse 180 kB (PERF-1).
6. GitHub Actions `.github/workflows/ci.yml` sur `pull_request` et `push` :
   `npm ci` → typecheck → lint → test (couverture) → build → size → e2e (artefacts
   Playwright conservés en cas d'échec). Cache npm. Node 22.
7. Ajouter `npm run e2e` et la commande `npm run check` (tout sauf e2e) ; documenter dans
   `CLAUDE.md`.

**Critères d'acceptation**
- La CI passe sur la branche ; elle échoue si on casse volontairement un test (vérifier
  localement puis annuler).
- Rapport de couverture affiché dans la sortie CI.
- Aucun fichier de l'app modifié hormis les corrections d'accessibilité justifiées.
