# Modèle — revue de code d'un lot

---

Tu relis la branche <nom> de FocusDeck avant fusion. Lis `CLAUDE.md`,
`docs/prompts/README.md` et le prompt du lot concerné dans `docs/prompts/`.

Vérifie, dans cet ordre, et ne rapporte que ce qui est réel (avec fichier:ligne et un
scénario concret de défaillance) :
1. **Exactitude** : chaque exigence annoncée est-elle réellement implémentée et testée ?
2. **Données** : risque de perte ou de corruption (migrations, sync, conflits, purge) ?
3. **Sécurité** : RLS, secrets, validation des entrées, XSS, CSP.
4. **Minuteur** : dérive, double historisation d'une fin de phase, comportement en
   arrière-plan et au rechargement.
5. **Accessibilité et mobile** : clavier, rôles ARIA, contrastes, 390 px.
6. **Performance** : re-rendus à chaque tick, taille du bundle, imports non paresseux.
7. **Cohérence** : règles de `CLAUDE.md` respectées, documentation mise à jour.

Lance toi-même `npm run check` et les e2e. Termine par un verdict : « prêt à fusionner »
ou la liste des points bloquants, puis les suggestions non bloquantes séparément.
