# Modèle — correction de bug

---

Tu travailles sur FocusDeck. Lis `CLAUDE.md` et `docs/prompts/README.md`.

**Symptôme** : <ce que l'utilisateur voit>
**Étapes pour reproduire** : <1. … 2. … 3. …>
**Attendu** : <comportement correct>
**Environnement** : <navigateur, appareil, connecté ou non>

**Démarche imposée**
1. Reproduire d'abord : écrire un test (unitaire si la cause est dans `utils/`, sinon e2e)
   qui échoue. Si tu n'arrives pas à reproduire, dis-le et explique ce que tu as essayé.
2. Trouver la cause racine (pas de contournement du symptôme). L'expliquer en 2–3 phrases.
3. Corriger au plus petit périmètre ; le test passe ; tous les autres aussi.
4. Chercher le même défaut ailleurs dans le code.
5. Livrer selon la règle 6, commit `fix: …` qui explique la cause.
