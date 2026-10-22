-- FocusDeck — lot L4 : projets, estimations, report de tâches, tâche active des sessions.
-- Les colonnes `tasks.project_id`, `tasks.estimate`, `tasks.position` et `sessions.task_id`
-- existent depuis le schéma initial ; cette migration complète ce qui manque à la sync.

-- ---------------------------------------------------------------------------
-- Projets : date de création (ordre stable entre appareils), limite par utilisateur
-- ---------------------------------------------------------------------------

alter table public.projects add column created_at timestamptz not null default now();

create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.projects where user_id = new.user_id and id <> new.id) >= 100 then
    raise exception 'Limite de 100 projets atteinte' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger projects_limit
  before insert on public.projects
  for each row execute function public.enforce_project_limit();

-- ---------------------------------------------------------------------------
-- Tâches : jour prévu (report au lendemain, EF-O05)
-- ---------------------------------------------------------------------------

alter table public.tasks add column planned_for date;

-- ---------------------------------------------------------------------------
-- Références sans clé étrangère
--
-- Le client envoie sa file dans l'ordre projets → tâches → sessions, mais une tâche créée
-- puis supprimée hors ligne n'atteint jamais le serveur alors que ses sessions, elles,
-- sont envoyées. Avec une clé étrangère, une seule référence orpheline bloquerait toute
-- la file indéfiniment. Ces colonnes deviennent donc de simples références, résolues côté
-- client (une référence inconnue s'affiche « sans projet » / « sans tâche ») ; la RLS
-- garantit toujours qu'un utilisateur ne lit que ses propres lignes.
-- ---------------------------------------------------------------------------

alter table public.tasks drop constraint if exists tasks_project_id_fkey;
alter table public.sessions drop constraint if exists sessions_task_id_fkey;

create index tasks_user_project_idx on public.tasks (user_id, project_id);
create index projects_user_updated_idx on public.projects (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- Realtime : les projets se diffusent comme les autres tables synchronisées
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.projects;
  end if;
end;
$$;
