import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

/**
 * Reproduit le minimum de l'environnement Supabase dans PGlite (Postgres en WebAssembly) :
 * schéma `auth`, fonction `auth.uid()` lue depuis le JWT, rôles et droits par défaut.
 * Les migrations réelles sont ensuite appliquées telles quelles.
 */
const SHIM = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  -- Droits par défaut de Supabase : tout est accordé, la protection repose sur RLS.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

export interface TestDatabase {
  db: PGlite;
  /** Exécute `fn` avec les droits d'un utilisateur connecté (ou anonyme si `null`). */
  as<T>(userId: string | null, fn: (db: PGlite) => Promise<T>): Promise<T>;
  createUser(id: string, email?: string): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const db = new PGlite();
  await db.exec(SHIM);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }

  return {
    db,
    async as(userId, fn) {
      await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
      try {
        return await fn(db);
      } finally {
        await db.exec('reset role');
        await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
      }
    },
    async createUser(id, email = `${id.slice(0, 8)}@exemple.fr`) {
      await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
    },
  };
}
