-- FocusDeck — schéma initial (cahier des charges §6.3, lot L2).
-- Toutes les tables sont protégées par RLS : un utilisateur n'accède qu'à ses lignes (SEC-1).
-- Les horodatages `updated_at` sont posés par le serveur : ils servent de curseur de
-- synchronisation et d'arbitre « dernier écrit gagne » (§6.4).

-- ---------------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profils (créés automatiquement à l'inscription)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  timezone text not null default 'Europe/Paris' check (char_length(timezone) <= 64),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Réglages du minuteur (document JSON validé côté client par sanitizeSettings)
-- ---------------------------------------------------------------------------

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 4096),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Projets (utilisés à partir du lot L4)
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#a855f7' check (color ~ '^#[0-9a-fA-F]{6}$'),
  client text check (char_length(client) <= 80),
  archived_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Micro-objectifs (suppression logique pour propager les suppressions)
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null check (char_length(title) between 1 and 140),
  completed boolean not null default false,
  completed_at timestamptz,
  position double precision not null default 0,
  estimate smallint check (estimate between 1 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index tasks_user_updated_idx on public.tasks (user_id, updated_at);

-- Limite SEC-4 : 200 tâches actives par utilisateur.
create or replace function public.enforce_task_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.tasks where user_id = new.user_id and deleted_at is null and id <> new.id) >= 200 then
    raise exception 'Limite de 200 tâches actives atteinte' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger tasks_limit
  before insert on public.tasks
  for each row when (new.deleted_at is null)
  execute function public.enforce_task_limit();

-- ---------------------------------------------------------------------------
-- Sessions du minuteur. L'identifiant est déterministe (mode + début de phase) :
-- deux appareils qui terminent la même phase n'écrivent qu'une ligne.
-- ---------------------------------------------------------------------------

create table public.sessions (
  id text primary key check (char_length(id) <= 80),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  mode text not null check (mode in ('focus', 'shortBreak', 'longBreak')),
  started_at timestamptz not null,
  ended_at timestamptz not null check (ended_at >= started_at),
  duration_seconds integer not null check (duration_seconds between 0 and 86400),
  completed boolean not null,
  day date not null,
  updated_at timestamptz not null default now(),
  -- Suppression logique (« Effacer l'historique du jour ») propagée aux autres appareils.
  deleted_at timestamptz
);

create index sessions_user_day_idx on public.sessions (user_id, day);
create index sessions_user_updated_idx on public.sessions (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- État du minuteur partagé entre appareils (EF-T04, diffusé via Realtime)
-- ---------------------------------------------------------------------------

create table public.timer_states (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  snapshot jsonb check (snapshot is null or (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) < 2048)),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Abonnements (écrits uniquement par le webhook Stripe, lot L6)
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  status text,
  price_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Horodatage serveur
-- ---------------------------------------------------------------------------

create trigger settings_updated_at before insert or update on public.settings for each row execute function public.set_updated_at();
create trigger projects_updated_at before insert or update on public.projects for each row execute function public.set_updated_at();
create trigger tasks_updated_at before insert or update on public.tasks for each row execute function public.set_updated_at();
create trigger sessions_updated_at before insert or update on public.sessions for each row execute function public.set_updated_at();
create trigger timer_states_updated_at before insert or update on public.timer_states for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before insert or update on public.subscriptions for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (SEC-1)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.sessions enable row level security;
alter table public.timer_states enable row level security;
alter table public.subscriptions enable row level security;

create policy "Profil : lecture du sien" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Profil : modification du sien" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Réglages : les siens" on public.settings
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Projets : les siens" on public.projects
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Tâches : les siennes" on public.tasks
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Sessions : les siennes" on public.sessions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Minuteur : le sien" on public.timer_states
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Abonnement : lecture seule pour l'utilisateur ; écriture réservée au service (webhook).
create policy "Abonnement : lecture du sien" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

-- Le plan d'un profil ne peut pas être modifié par l'utilisateur lui-même. Un `revoke`
-- de colonne n'annule pas le droit de table accordé par défaut par Supabase : on retire
-- donc le droit de table, puis on rend explicitement les colonnes modifiables.
revoke update, insert, delete on public.profiles from anon, authenticated;
grant update (display_name, locale, timezone) on public.profiles to authenticated;
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime : diffusion des changements utiles à la synchronisation
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.settings, public.tasks, public.sessions, public.timer_states;
  end if;
end;
$$;
