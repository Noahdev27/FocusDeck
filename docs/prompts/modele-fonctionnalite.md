# Modèle — nouvelle fonctionnalité

---

Tu travailles sur FocusDeck. Lis `CLAUDE.md`, `docs/prompts/README.md` et les sections
pertinentes de `docs/cahier-des-charges.md`.

**Fonctionnalité** : <décrire le besoin utilisateur en une phrase : « En tant que …, je veux …, afin de … »>

**Exigences liées** : <IDs existants, ou « nouvelle exigence à ajouter au cahier des charges »>

**Comportement attendu**
- <cas nominal>
- <cas limites : vide, maximum, hors ligne, mobile, clavier seul>

**Hors périmètre** : <ce qu'il ne faut pas faire>

**Démarche** : propose d'abord un plan (fichiers, logique pure à tester, impact sur les
données stockées). Si une donnée persistée change de format, prévois la migration et son
test. Puis implémente, vérifie (règle 5) et livre (règle 6). Ajoute l'exigence au cahier
des charges si elle est nouvelle.
