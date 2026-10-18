import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';

// Backend/scripts/db-migrate.mjs applies Database/schemas/*.sql once each and remembers it.
// What a unit test cannot show is that all of those files really apply, in order, to an empty
// database (several use ALTER TYPE ... ADD VALUE), that a second run does nothing, and that a
// database with tables but no history is never guessed at. Each case gets its own database.
const SCHEMAS = join(__dirname, '..', '..', 'Database', 'schemas');
const RUNNER = join(__dirname, '..', 'scripts', 'db-migrate.mjs');
const FILES = readdirSync(SCHEMAS).filter((f) => /^\d{3}_.+\.sql$/.test(f));

const base = new URL(process.env.DATABASE_URL as string);
const urlFor = (name: string) => {
  const u = new URL(base.toString());
  u.pathname = `/${name}`;
  return u.toString();
};
// A short-lived connection (TypeORM's pg driver, so no extra type package): one statement, then closed.
async function sql<T = unknown>(
  database: string,
  statement: string,
): Promise<T[]> {
  const ds = new DataSource({ type: 'postgres', url: urlFor(database) });
  await ds.initialize();
  try {
    return await ds.query(statement);
  } finally {
    await ds.destroy();
  }
}
const maintenance = base.pathname.slice(1);

const created: string[] = [];
async function freshDatabase(): Promise<string> {
  const name = `migrate_${randomBytes(4).toString('hex')}`;
  await sql(maintenance, `create database ${name}`);
  created.push(name);
  return name;
}
const run = (name: string, extra: Record<string, string> = {}) =>
  spawnSync('node', [RUNNER], {
    env: {
      ...process.env,
      DATABASE_URL: urlFor(name),
      DATABASE_SSL: 'disable',
      ...extra,
    },
    encoding: 'utf8',
  });

describe('db-migrate (e2e)', () => {
  jest.setTimeout(120000);

  afterAll(async () => {
    for (const name of created)
      await sql(maintenance, `drop database if exists ${name} with (force)`);
  });

  it('applies every schema file, in order, to an empty database', async () => {
    const db = await freshDatabase();

    const result = run(db);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Applied ${FILES.length} file(s).`);
    const rows = await sql<{ filename: string }>(
      db,
      'select filename from schema_migrations order by filename',
    );
    expect(rows.map((r) => r.filename)).toEqual([...FILES].sort());
    const tables = await sql<{ t: string | null }>(
      db,
      "select to_regclass('public.users') t union all select to_regclass('public.document_counters')",
    );
    expect(tables.every((r) => r.t !== null)).toBe(true);
  });

  it('does nothing the second time', async () => {
    const db = await freshDatabase();
    expect(run(db).status).toBe(0);

    const again = run(db);

    expect(again.status).toBe(0);
    expect(again.stdout).toContain('Nothing to apply');
  });

  it('refuses to guess at a database that has tables but no history', async () => {
    const db = await freshDatabase();
    await sql(db, 'create table users (id int)');

    const result = run(db);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('MIGRATE_BASELINE');
    expect(
      await sql(db, "select to_regclass('public.schema_migrations') t"),
    ).toEqual([{ t: null }]);
  });

  it('records the files up to the baseline without running them, then applies only what is newer', async () => {
    const db = await freshDatabase();
    await sql(db, 'create table users (id int)');
    const lastButOne = FILES.map((f) => f.slice(0, 3))
      .sort()
      .slice(-2, -1)[0];

    const result = run(db, { MIGRATE_BASELINE: lastButOne });

    // The newest file runs against that stub and fails: proof that only files past the baseline are executed.
    expect(result.stdout).toContain(
      `baseline  ${FILES.sort()[FILES.length - 2]}`,
    );
    expect(result.stdout).not.toContain('applied   001');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `FAILED    ${FILES.sort()[FILES.length - 1]}`,
    );
    const rows = await sql<{ filename: string }>(
      db,
      'select filename from schema_migrations',
    );
    expect(rows).toHaveLength(FILES.length - 1);
  });
});
