// Applies Database/schemas/NNN_*.sql, in order, once each, and remembers which it has applied
// (table schema_migrations). Run before each backend start (Railway "pre-deploy command":
// `node scripts/db-migrate.mjs`), so a schema file merged with the code reaches the database
// the code expects. Until now every schema file was applied by hand.
//
//   DATABASE_URL=... [DATABASE_SSL=disable|no-verify] [MIGRATE_BASELINE=017] node scripts/db-migrate.mjs
//
// A database that already has the tables but no history (every database before this runner) is NOT
// guessed at: set MIGRATE_BASELINE to the last file number already applied (say 017) once, and
// those files are recorded without being run. A fresh, empty database gets every file.
//
// Files are not wrapped in a transaction of their own: several use ALTER TYPE ... ADD VALUE, which
// their authors note is not valid inside one. Each file is sent as one multi-statement query, so
// Postgres applies it as a unit (all of it or none of it).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const dir = process.env.SCHEMAS_DIR || join(here, '..', '..', 'Database', 'schemas');
// Held for the whole run so two instances starting together cannot apply the same file twice.
const LOCK_KEY = 727274;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(2);
}
// The same switch the app uses (DATABASE_SSL): unset = verified TLS; 'disable' for a database with no
// TLS; 'no-verify' for a self-signed one. NODE_ENV=test with it unset means no TLS (the throwaway e2e database).
const mode = process.env.DATABASE_SSL;
const ssl = mode === 'disable' || (!mode && process.env.NODE_ENV === 'test') ? false : mode === 'no-verify' ? { rejectUnauthorized: false } : true;

const files = readdirSync(dir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
const sum = (text) => createHash('sha256').update(text).digest('hex');
const numberOf = (file) => Number.parseInt(file.slice(0, 3), 10);

const client = new pg.Client({ connectionString: url, ssl });
await client.connect();
try {
  await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);
  const exists = async (name) => (await client.query('select to_regclass($1) as t', [`public.${name}`])).rows[0].t !== null;
  const hadHistory = await exists('schema_migrations');
  const hasTables = await exists('users');

  // Decide before creating anything: refusing must leave the database exactly as it was, or the next run
  // would see a history table, skip this check and apply every file on top of the existing tables.
  if (!hadHistory && hasTables && !process.env.MIGRATE_BASELINE) {
    console.error('This database already has tables but no migration history. Set MIGRATE_BASELINE to the number of the last schema file already applied (for example 017) once; those files are then recorded without being run.');
    process.exit(1);
  }

  await client.query('create table if not exists schema_migrations (filename text primary key, checksum text not null, applied_at timestamptz not null default now())');

  if (!hadHistory && hasTables) {
    const baseline = process.env.MIGRATE_BASELINE;
    for (const file of files.filter((f) => numberOf(f) <= Number.parseInt(baseline, 10))) {
      await client.query('insert into schema_migrations (filename, checksum) values ($1, $2) on conflict do nothing', [file, sum(readFileSync(join(dir, file), 'utf8'))]);
      console.log(`baseline  ${file} (recorded, not run)`);
    }
  }

  const applied = new Map((await client.query('select filename, checksum from schema_migrations')).rows.map((r) => [r.filename, r.checksum]));
  let ran = 0;
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8');
    if (applied.has(file)) {
      // An applied file must not change: edit a new one instead. A warning, not a failure, so a comment fix cannot stop a deploy.
      if (applied.get(file) !== sum(sql)) console.warn(`warning   ${file} has changed since it was applied; add a new numbered file instead of editing it`);
      continue;
    }
    try {
      await client.query(sql);
    } catch (error) {
      console.error(`FAILED    ${file}: ${error.message}`);
      process.exit(1);
    }
    await client.query('insert into schema_migrations (filename, checksum) values ($1, $2)', [file, sum(sql)]);
    console.log(`applied   ${file}`);
    ran += 1;
  }
  console.log(ran === 0 ? 'Nothing to apply: the database is up to date.' : `Applied ${ran} file(s).`);
} finally {
  await client.end();
}
