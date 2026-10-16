# L8 — RGPD, e-mails, partage et intégrations

---

Tu travailles sur FocusDeck. Lis `CLAUDE.md`, `docs/prompts/README.md` et
`docs/cahier-des-charges.md` EF-C07, EF-R06, EF-R07, EF-I01, EF-I02, §5 (RGPD, SEC).

**À faire**
1. Export complet (EF-C07) : Edge Function `export-data` → JSON versionné de toutes les
   données de l'utilisateur ; bouton dans les réglages du compte. Le même format est
   importable en mode local (aller-retour testé).
2. Suppression de compte : confirmation par saisie, Edge Function `delete-account`
   (données, abonnement Stripe annulé, utilisateur Auth), e-mail de confirmation.
3. Rapport quotidien par e-mail (EF-R06) : préférence heure + fuseau ; tâche planifiée
   (pg_cron ou cron d'Edge Function) ; Resend ; gabarit HTML sobre + version texte ;
   lien de désabonnement en un clic. Ne rien envoyer en dehors du mode test sans accord.
4. Partage en lecture seule (EF-R07) : jeton aléatoire non devinable, expiration
   (7 jours par défaut), révocable, page publique sans données personnelles au-delà du
   rapport, `noindex`.
5. Intégrations (EF-I01, EF-I02) — **seulement si l'utilisateur confirme le besoin** :
   export Notion via OAuth, statut Slack pendant un focus. Jetons chiffrés côté serveur.

**Critères d'acceptation**
- Après suppression, plus aucune ligne liée à l'utilisateur en base (test).
- Le lien de partage expiré ou révoqué renvoie une page « Lien expiré », jamais de données.
