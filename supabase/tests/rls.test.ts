// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './supabaseShim';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const TASK_A = '10000000-0000-4000-8000-00000000000a';
const PROJECT_A = '20000000-0000-4000-8000-00000000000a';

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
  await t.createUser(A);
  await t.createUser(B);
  await t.as(A, (db) =>
    db.exec(`
      insert into public.settings (data) values ('{"focusMinutes": 50}');
      insert into public.projects (id, name, client) values ('${PROJECT_A}', 'Site Acme', 'Acme');
      insert into public.tasks (id, title, project_id, estimate, planned_for) values ('${TASK_A}', 'Devis Acme', '${PROJECT_A}', 3, current_date + 1);
      insert into public.sessions (id, mode, started_at, ended_at, duration_seconds, completed, day)
        values ('focus:1', 'focus', now() - interval '25 minutes', now(), 1500, true, current_date);
      insert into public.timer_states (snapshot) values ('{"mode": "focus"}');
    `),
  );
}, 30_000);

const count = async (userId: string | null, table: string) =>
  t.as(userId, async (db) => Number((await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`)).rows[0]?.n));

describe('RLS (SEC-1, parcours critique 7)', () => {
  it('crée un profil gratuit à l’inscription', async () => {
    const rows = await t.as(A, async (db) => (await db.query('select id, plan from public.profiles')).rows);
    expect(rows).toEqual([{ id: A, plan: 'free' }]);
  });

  it('chaque utilisateur ne voit que ses propres données', async () => {
    for (const table of ['settings', 'projects', 'tasks', 'sessions', 'timer_states', 'profiles']) {
      expect(await count(A, table), `A lit ${table}`).toBe(1);
      expect(await count(B, table), `B ne lit pas ${table} de A`).toBe(table === 'profiles' ? 1 : 0);
      expect(await count(null, table), `anonyme lit ${table}`).toBe(0);
    }
  });

  it('B ne peut ni écrire au nom de A, ni modifier ou supprimer ses lignes', async () => {
    await expect(
      t.as(B, (db) => db.query(`insert into public.tasks (id, user_id, title) values (gen_random_uuid(), $1, 'pirate')`, [A])),
    ).rejects.toThrow(/row-level security/);

    const updated = await t.as(B, async (db) => (await db.query(`update public.tasks set title = 'pirate' where id = $1`, [TASK_A])).affectedRows);
    const deleted = await t.as(B, async (db) => (await db.query(`delete from public.sessions where id = 'focus:1'`)).affectedRows);
    expect(updated).toBe(0);
    expect(deleted).toBe(0);
    const title = await t.as(A, async (db) => (await db.query<{ title: string }>(`select title from public.tasks`)).rows[0]?.title);
    expect(title).toBe('Devis Acme');
  });

  it('un anonyme ne peut rien écrire', async () => {
    await expect(t.as(null, (db) => db.query(`insert into public.tasks (id, title) values (gen_random_uuid(), 'x')`))).rejects.toThrow();
  });

  it('l’utilisateur ne peut pas se donner le plan Pro ni écrire son abonnement', async () => {
    await expect(t.as(A, (db) => db.query(`update public.profiles set plan = 'pro'`))).rejects.toThrow(/permission denied/);
    await expect(
      t.as(A, (db) => db.query(`insert into public.subscriptions (user_id, status) values ($1, 'active')`, [A])),
    ).rejects.toThrow(/permission denied/);
    const changed = await t.as(A, async (db) => (await db.query(`update public.profiles set display_name = 'Noé'`)).affectedRows);
    expect(changed).toBe(1);
  });
});

describe('Contraintes (SEC-4)', () => {
  it('borne les titres et les modes', async () => {
    await expect(t.as(A, (db) => db.query(`insert into public.tasks (id, title) values (gen_random_uuid(), '')`))).rejects.toThrow(/check/);
    await expect(
      t.as(A, (db) => db.query(`insert into public.tasks (id, title) values (gen_random_uuid(), repeat('x', 141))`)),
    ).rejects.toThrow(/check/);
    await expect(
      t.as(A, (db) =>
        db.query(`insert into public.sessions (id, mode, started_at, ended_at, duration_seconds, completed, day)
                  values ('x', 'sieste', now(), now(), 1, true, current_date)`),
      ),
    ).rejects.toThrow(/check/);
  });

  it('limite à 200 tâches actives', async () => {
    await t.as(B, (db) =>
      db.exec(`insert into public.tasks (id, title) select gen_random_uuid(), 'T' || g from generate_series(1, 200) g`),
    );
    await expect(t.as(B, (db) => db.query(`insert into public.tasks (id, title) values (gen_random_uuid(), 'de trop')`))).rejects.toThrow(
      /200 tâches/,
    );
    // Une tâche supprimée (logiquement) libère une place.
    await t.as(B, (db) => db.exec(`update public.tasks set deleted_at = now() where title = 'T1'`));
    await expect(t.as(B, (db) => db.query(`insert into public.tasks (id, title) values (gen_random_uuid(), 'ok')`))).resolves.toBeDefined();
  });

  it('pose un horodatage serveur croissant à chaque écriture (curseur de synchronisation)', async () => {
    const read = () => t.as(A, async (db) => (await db.query<{ updated_at: Date }>(`select updated_at from public.tasks where id = $1`, [TASK_A])).rows[0]?.updated_at);
    const before = await read();
    await t.as(A, (db) => db.query(`update public.tasks set completed = true where id = $1`, [TASK_A]));
    const after = await read();
    expect(after && before && after.getTime() > before.getTime()).toBe(true);
  });
});

describe('Lot L4 : projets, estimations, report, tâche active', () => {
  it('B ne voit ni ne modifie les projets de A', async () => {
    const renamed = await t.as(B, async (db) => (await db.query(`update public.projects set name = 'pirate' where id = $1`, [PROJECT_A])).affectedRows);
    expect(renamed).toBe(0);
    await expect(
      t.as(B, (db) => db.query(`insert into public.projects (id, user_id, name) values (gen_random_uuid(), $1, 'pirate')`, [A])),
    ).rejects.toThrow(/row-level security/);
  });

  it('borne nom, couleur et estimation', async () => {
    await expect(t.as(A, (db) => db.query(`insert into public.projects (id, name) values (gen_random_uuid(), '')`))).rejects.toThrow(/check/);
    await expect(
      t.as(A, (db) => db.query(`insert into public.projects (id, name, color) values (gen_random_uuid(), 'X', 'rouge')`)),
    ).rejects.toThrow(/check/);
    await expect(
      t.as(A, (db) => db.query(`insert into public.tasks (id, title, estimate) values (gen_random_uuid(), 'X', 9)`)),
    ).rejects.toThrow(/check/);
  });

  it('une référence orpheline (tâche ou projet jamais envoyé) ne bloque pas la synchronisation', async () => {
    const orphan = '30000000-0000-4000-8000-000000000000';
    await t.as(A, (db) =>
      db.exec(`
        insert into public.tasks (id, title, project_id) values (gen_random_uuid(), 'Projet inconnu', '${orphan}');
        insert into public.sessions (id, task_id, mode, started_at, ended_at, duration_seconds, completed, day)
          values ('focus:orphelin', '${orphan}', 'focus', now() - interval '25 minutes', now(), 1500, true, current_date);
      `),
    );
    const taskId = await t.as(A, async (db) => (await db.query<{ task_id: string }>(`select task_id from public.sessions where id = 'focus:orphelin'`)).rows[0]?.task_id);
    expect(taskId).toBe(orphan);
  });

  it('limite à 100 projets par utilisateur', async () => {
    await t.as(B, (db) => db.exec(`insert into public.projects (id, name) select gen_random_uuid(), 'P' || g from generate_series(1, 100) g`));
    await expect(t.as(B, (db) => db.query(`insert into public.projects (id, name) values (gen_random_uuid(), 'de trop')`))).rejects.toThrow(/100 projets/);
    // La mise à jour d'un projet existant (upsert de la synchronisation) reste possible.
    await expect(t.as(B, (db) => db.query(`update public.projects set archived_at = now() where name = 'P1'`))).resolves.toBeDefined();
  });

  it('horodate la création et la modification d’un projet', async () => {
    const row = await t.as(A, async (db) => (await db.query<{ created_at: Date; updated_at: Date }>(`select created_at, updated_at from public.projects where id = $1`, [PROJECT_A])).rows[0]);
    expect(row?.created_at).toBeInstanceOf(Date);
    expect(row?.updated_at).toBeInstanceOf(Date);
  });
});

