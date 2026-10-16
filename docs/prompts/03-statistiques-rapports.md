# L3 — Historique, statistiques et rapports de période

---

Tu travailles sur FocusDeck. Lis `CLAUDE.md`, `docs/prompts/README.md` et
`docs/cahier-des-charges.md` §4.3, EF-T07, §5 (PERF, A11Y). Charge le skill `dataviz`
avant d'écrire le moindre graphique.

**Objectif** : donner du sens à l'historique — page `/stats` et page `/rapports`.

**À faire**
1. Domaine pur `src/domain/stats.ts` : agrégation par jour/semaine/mois, série de jours
   consécutifs (fuseau local, changement d'heure inclus), répartition par projet (si L4
   présent, sinon « Sans projet »), moyenne et meilleur jour. Tests exhaustifs, y compris
   jours vides et passage à l'heure d'été/hiver.
2. Généraliser `buildDailyReport` en `buildReport(range, filters)` ; le rapport du jour
   devient un cas particulier (sortie Markdown/PDF existante inchangée, tests existants
   conservés).
3. `/stats` : barres de temps de focus (7/30 jours), carte de chaleur annuelle, série,
   objectif quotidien de cycles réglable avec jauge (EF-T07). Graphiques en SVG fait main
   ou bibliothèque légère chargée à la demande ; accessibles (tableau de données
   alternatif, `aria-label`), lisibles en thème sombre (et clair si L5 est fait).
4. `/rapports` : sélecteur de période (jour, semaine, mois, plage libre), filtre projet,
   aperçu, export Markdown/PDF/CSV (EF-R04 : colonnes listées dans le cahier des charges,
   séparateur `;` et BOM UTF-8 pour Excel FR).
5. Mode local : la rétention passe de 30 jours à 365 jours **avec plafond de taille**
   (purger les plus anciennes au-delà de ~2 Mo) ; migration testée.
6. e2e : données injectées via `localStorage` sur plusieurs jours → vérifier série, totaux
   et fichier CSV.

**Critères d'acceptation**
- Totaux identiques entre `/stats`, `/rapports` et le rapport du jour (test croisé).
- Aucun recalcul lourd à chaque tick du minuteur (mémoïsation vérifiée).
