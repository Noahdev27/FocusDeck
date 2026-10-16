# L5 — PWA, notifications, thème clair, langues, sons

---

Tu travailles sur FocusDeck. Lis `CLAUDE.md`, `docs/prompts/README.md` et
`docs/cahier-des-charges.md` §4.5 (EF-X02..X06), EF-T05, §5 (A11Y-1, PERF).

**À faire**
1. PWA (EF-X02) : `vite-plugin-pwa` (stratégie `generateSW` ou `injectManifest` justifiée),
   manifest FR, icônes (maskable incluses) dérivées de `public/favicon.svg`, invite de
   mise à jour « Nouvelle version disponible ». Fonctionne hors ligne après la 1re visite.
2. Notifications (EF-X03) : passer par `registration.showNotification` ; au démarrage
   d'une phase, planifier la notification de fin côté Service Worker quand l'API le
   permet, sinon repli actuel. Clic sur la notification → focus de l'onglet.
3. Thème (EF-X04) : tokens de couleur en variables CSS dans `@theme`, variante claire
   complète, sélecteur Système/Clair/Sombre dans les réglages, pas de flash au chargement
   (script inline minimal dans `index.html`). Contrastes AA vérifiés par axe dans les deux
   thèmes ; couleurs de mode (`MODE_META`) ajustées si besoin.
4. i18n (EF-X05) : FR (par défaut) et EN. Solution légère (dictionnaires typés, clé
   manquante = erreur TypeScript) plutôt qu'une grosse bibliothèque ; formats de date et
   pluriels via `Intl`. Le rapport s'exporte dans la langue de l'interface.
5. Sons (EF-T05) : 3 carillons synthétisés + silencieux, aperçu dans les réglages ; bruit
   brun optionnel pendant le Focus (Web Audio, volume séparé).
6. Onboarding (EF-X06) : 3 écrans maximum, sautable, rejouable depuis l'aide raccourcis.

**Critères d'acceptation**
- Lighthouse : PWA installable ; Performance/Accessibilité ≥ 95 en mobile, dans les deux thèmes.
- Aucune chaîne française en dur restante dans `src/components/` (test qui le vérifie).
- Hors ligne (DevTools) : l'app se charge et le minuteur fonctionne.
