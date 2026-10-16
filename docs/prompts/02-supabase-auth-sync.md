# L2 — Supabase : comptes, base de données, synchronisation

---

Tu travailles sur FocusDeck. Lis `CLAUDE.md`, `docs/prompts/README.md` et
`docs/cahier-des-charges.md` §4.4, §5 (SEC, RGPD-1), §6 en entier, §8 parcours 6–7.
Le lot L1 (`src/data/`, `FocusRepository`) doit être mergé ; sinon arrête-toi et dis-le.

**Préalable — à confirmer avec l'utilisateur avant d'écrire du code dépendant**
- Projet Supabase : en existe-t-il un (URL + clé publique) ? Sinon, proposer de le créer
  (région UE) et **attendre l'accord** avant toute création (ressource potentiellement
  payante). En attendant, tout développer contre la stack locale (`supabase start`) si
  Docker est disponible, sinon contre des tests unitaires avec un client simulé.

**À faire**
1. `supabase/migrations/` : schéma §6.3 (tables, contraintes `check`, index, `updated_at`
   par trigger), RLS sur toutes les tables, `profiles` créé par trigger à l'inscription.
   Tests SQL des politiques (pgTAP ou script) : A ne lit/écrit jamais B.
2. Générer les types TypeScript (`supabase gen types`) dans `src/data/supabase.types.ts`.
3. Auth : lien magique + Google OAuth. UI : bouton « Se connecter » dans le Header,
   modale de connexion, menu compte (e-mail, déconnexion avec choix EF-C06). Mode local
   inchangé si `VITE_SUPABASE_URL` est absent (EF-C01).
4. `SyncedRepository` (§6.4) : écriture locale immédiate, file `outbox` persistée,
   vidage au retour réseau + intervalle, backoff, curseur `updated_at`, suppression
   logique, « dernier écrit gagne ». Faire passer la suite de contrat de L1.
5. Fusion à la première connexion (EF-C03) : upsert des UUID locaux, aucune duplication si
   on se connecte deux fois depuis le même appareil. Tests dédiés.
6. Minuteur multi-appareils (EF-T04) : `timer_states` + Realtime ; l'appareil qui agit
   écrit le snapshot, les autres l'appliquent (validé par `sanitizeTimerSnapshot`). Une
   fin de phase ne doit être historisée **qu'une fois** (clé idempotente = `endsAt`).
7. Indicateur discret de synchronisation (synchronisé / en attente / hors ligne).
8. e2e parcours 6 et 7 (deux contextes navigateur, `context.setOffline(true)`).

**Contraintes** : seule la clé publique côté client (SEC-2) ; `@supabase/supabase-js`
chargé à la demande pour respecter PERF-1 ; aucune donnée personnelle dans les logs.

**Critères d'acceptation**
- Parcours 6 et 7 verts ; suite de contrat verte pour les deux repositories.
- Couper le réseau 10 minutes en plein usage ne perd ni tâche ni session.
- `.env.example` documente les variables ; aucun secret commité.
