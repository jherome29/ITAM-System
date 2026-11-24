// Creates the first System Administrator on a fresh database (the dev seed is never run on a
// hosted environment: its accounts have passwords that are published in the repo).
//
//   BOOTSTRAP_DB_URL=<public postgres URL> ADMIN_EMAIL=you@example.com \
//     node Backend/scripts/bootstrap-admin.mjs
//
// The password is generated here, written to .env.admin.local (git-ignored) and NEVER printed,
// so it does not land in a terminal log or a chat. Refuses to touch an existing account.
import { randomBytes, randomInt } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import bcrypt from 'bcrypt';
import pg from 'pg';

const url = process.env.BOOTSTRAP_DB_URL;
const email = process.env.ADMIN_EMAIL;
if (!url || !email) {
  console.error('Set BOOTSTRAP_DB_URL and ADMIN_EMAIL.');
  process.exit(1);
}

// bcrypt rounds: the same minimum the app enforces (CLAUDE.md section 8.1).
const ROUNDS = 12;

/** 20 characters with an upper, a lower, a digit and a symbol, so it passes the app's password policy. */
function strongPassword() {
  const pools = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%^&*-_=+'];
  const all = pools.join('');
  const chars = pools.map((p) => p[randomInt(p.length)]);
  while (chars.length < 20) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// Verified TLS by default, like DATABASE_SSL in the app. Railway's public database proxy uses a
// self-signed certificate, so set BOOTSTRAP_DB_SSL=no-verify for that one-off run (still encrypted).
const ssl = process.env.BOOTSTRAP_DB_SSL === 'no-verify' ? { rejectUnauthorized: false } : true;
const client = new pg.Client({ connectionString: url, ssl });
await client.connect();
try {
  const taken = await client.query('select 1 from users where lower(email) = lower($1) or employee_id = $2', [email, 'CICC-ADMIN-001']);
  if (taken.rowCount > 0) {
    console.error('An account with that email or employee ID already exists. Nothing changed.');
    process.exit(1);
  }
  const password = strongPassword();
  const hash = await bcrypt.hash(password, ROUNDS);
  await client.query(
    `insert into users (employee_id, first_name, last_name, email, password_hash, role, division, office_or_section, is_active)
     values ($1, $2, $3, $4, $5, 'system_admin', $6, $7, true)`,
    ['CICC-ADMIN-001', 'System', 'Administrator', email, hash, 'IT Division', 'Systems Administration'],
  );
  writeFileSync('.env.admin.local', `ADMIN_LOGIN=${email}\nADMIN_PASSWORD=${password}\n`, { mode: 0o600 });
  console.log('Administrator created. Login and password are in .env.admin.local (not printed).');
  console.log(`Run id ${randomBytes(3).toString('hex')}`);
} finally {
  await client.end();
}
