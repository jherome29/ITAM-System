#!/usr/bin/env node
/**
 * Fail the build on any HIGH or CRITICAL `npm audit` advisory that is NOT in
 * ALLOW. This keeps the `--audit-level=high` policy from
 * `.github/workflows/security.yml` — the allowlist only covers advisories that
 * have no non-breaking upstream fix, each with a written reason. Anything else
 * high/critical still fails, so a genuinely fixable CVE can't slip through.
 *
 * Usage:  node scripts/audit-allowlist.mjs [dir]     (dir defaults to ".")
 *
 * When a listed package can finally move, drop its GHSA(s) here and let the
 * plain audit pass again.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** GHSA id -> reason it is accepted (shown in the log on every run). */
const ALLOW = {
  // multer <= 2.2.0 DoS advisories. multer is reached transitively through
  // every @nestjs/* package (platform-express -> core -> schedule/testing/
  // typeorm); the only fix npm offers is `@nestjs/testing@7.5.5`, i.e. dropping
  // NestJS from 11 to 7. AIMRS is an internal LAN app behind CICC IT's reverse
  // proxy, and helmet + express already cap request/body sizes. Re-check when
  // @nestjs/platform-express ships a multer >= 2.2.1 dependency bump.
  'GHSA-wc9g-mqfw-jrwm': 'multer DoS via crafted multipart field names',
  'GHSA-qfvm-cv95-jqjf': 'multer DoS via file-descriptor leak on aborted uploads',
  'GHSA-qvfw-j98x-7q72': 'multer file-size-limit bypass (async fileFilter race)',
  'GHSA-535w-7cp7-47q4': 'multer DoS via oversized array index in field names',
};

const dir = resolve(process.argv[2] ?? '.');

let report;
try {
  // `npm audit` exits non-zero whenever vulnerabilities exist, but still writes
  // the JSON report to stdout — so a throw here is the normal path. The command
  // is a fixed literal with no interpolation; `execSync` runs it through the
  // platform shell so the Windows `npm.cmd` shim resolves.
  const out = execSync('npm audit --json', {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  report = JSON.parse(out);
} catch (err) {
  if (!err.stdout) {
    console.error(`audit-allowlist: could not run \`npm audit\` in ${dir}`);
    process.exit(2);
  }
  try {
    report = JSON.parse(err.stdout);
  } catch {
    console.error(`audit-allowlist: \`npm audit\` produced no parseable JSON in ${dir}`);
    process.exit(2);
  }
}

/** GHSA id -> { pkg, severity, title } for every high/critical advisory found. */
const found = new Map();
for (const [pkg, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  if (vuln.severity !== 'high' && vuln.severity !== 'critical') continue;
  for (const via of vuln.via ?? []) {
    if (typeof via !== 'object' || !via.url) continue;
    const id = String(via.url).split('/').pop() ?? '';
    if (id.startsWith('GHSA-')) {
      found.set(id, { pkg, severity: vuln.severity, title: via.title ?? '' });
    }
  }
}

const allowed = [...found].filter(([id]) => id in ALLOW);
const blocking = [...found].filter(([id]) => !(id in ALLOW));

for (const [id, info] of allowed) {
  console.log(`  allow  ${id}  ${info.severity.padEnd(8)} ${info.pkg} — ${ALLOW[id]}`);
}

if (blocking.length) {
  console.error(
    `\naudit-allowlist: ${blocking.length} un-allowlisted high/critical advisory(ies) in ${dir}:`,
  );
  for (const [id, info] of blocking) {
    console.error(`  BLOCK  ${id}  ${info.severity.padEnd(8)} ${info.pkg} — ${info.title}`);
  }
  console.error(
    '\nUpgrade the package, or (only if there is no non-breaking fix) add the GHSA' +
      ' to scripts/audit-allowlist.mjs with a reason.\n',
  );
  process.exit(1);
}

console.log(`audit-allowlist: OK for ${dir} — ${allowed.length} allowlisted, 0 blocking.`);
