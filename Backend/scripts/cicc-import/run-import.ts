import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ApiClient, ApiError } from '../../test/demo-seed/client';
import { parseWorkbook } from './parse-sheet';
import { AssetStatus } from '../../../packages/shared/src/enums';

// Loads CICC's real partial equipment list into AIMRS through the actual API
// — as the Asset Custodian account, same as a person registering each item by
// hand — so every row gets a real QR code, barcode and audit trail. Never
// writes to the database directly.
//
//   npx ts-node scripts/cicc-import/run-import.ts --file <path to .xlsx>                        # dry run — prints the plan
//   npx ts-node scripts/cicc-import/run-import.ts --file <path> --apply --limit 20               # pilot batch
//   npx ts-node scripts/cicc-import/run-import.ts --file <path> --apply --offset 20               # the rest, skipping the pilot rows
//
// Rows are processed in the order parseWorkbook returns them, so --offset N
// always skips exactly the same first N rows a previous --limit N run used —
// safe to resume without re-registering (and re-numbering) anything.
// Credentials come from an untracked JSON file (never the repo, CLAUDE.md §8.5):
//   --accounts <path>   defaults to ./scripts/cicc-import/accounts.local.json
//   { "login": "property.custodian@cicc.gov.ph", "password": "..." }

const DEFAULT_API = 'http://localhost:3001/api';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

interface Options {
  file: string;
  apply: boolean;
  allowRemote: boolean;
  apiUrl: string;
  accountsPath: string;
  limit?: number;
  offset: number;
}

function parseArgs(argv: string[]): Options {
  const flag = (name: string) => argv.includes(`--${name}`);
  const value = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const file = value('file');
  if (!file) throw new Error('Pass --file <path to the CICC .xlsx workbook>.');
  const limitRaw = value('limit');
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  if (limitRaw && (!Number.isFinite(limit) || (limit as number) <= 0)) {
    throw new Error(`--limit must be a positive integer, got "${limitRaw}".`);
  }
  const offsetRaw = value('offset');
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;
  if (offsetRaw && (!Number.isFinite(offset) || offset < 0)) {
    throw new Error(`--offset must be a non-negative integer, got "${offsetRaw}".`);
  }
  return {
    file: resolve(file),
    apply: flag('apply'),
    allowRemote: flag('allow-remote'),
    apiUrl: value('api') ?? DEFAULT_API,
    accountsPath: resolve(
      value('accounts') ?? './scripts/cicc-import/accounts.local.json',
    ),
    limit,
    offset,
  };
}

interface Credentials {
  login: string;
  password: string;
}

function readCredentials(path: string): Credentials {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(
      `Could not read/parse accounts file at ${path}. Expected ` +
        '{ "login": "...", "password": "..." }.',
    );
  }
  if (
    typeof raw !== 'object' ||
    raw === null ||
    typeof (raw as Credentials).login !== 'string' ||
    typeof (raw as Credentials).password !== 'string' ||
    !(raw as Credentials).login ||
    !(raw as Credentials).password
  ) {
    throw new Error(`Accounts file at ${path} needs a non-empty login and password.`);
  }
  return raw as Credentials;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const host = new URL(opts.apiUrl).hostname;
  if (!LOCAL_HOSTS.has(host) && !opts.allowRemote) {
    throw new Error(
      `${opts.apiUrl} is not localhost. Pass --allow-remote if this is deliberate.`,
    );
  }

  console.log(`Reading ${opts.file} …`);
  const { assets, needsReview } = await parseWorkbook(opts.file);
  const afterOffset = opts.offset ? assets.slice(opts.offset) : assets;
  const toRun = opts.limit ? afterOffset.slice(0, opts.limit) : afterOffset;

  const byType = new Map<string, number>();
  const byClass = new Map<string, number>();
  for (const { dto } of assets) {
    byType.set(dto.assetType, (byType.get(dto.assetType) ?? 0) + 1);
    byClass.set(dto.assetClass, (byClass.get(dto.assetClass) ?? 0) + 1);
  }

  console.log(`\nParsed ${assets.length} importable rows, ${needsReview.length} held out for review.`);
  console.log('By asset type:', Object.fromEntries(byType));
  console.log('By asset class:', Object.fromEntries(byClass));
  if (needsReview.length) {
    console.log('\nHeld out for manual review (not imported):');
    for (const r of needsReview) {
      console.log(`  [${r.sheet} row ${r.row}] ${r.reason}${r.itemDescription ? ` — ${r.itemDescription}` : ''}`);
    }
  }
  if (opts.offset || opts.limit) {
    console.log(`\nRunning ${toRun.length} of ${assets.length} rows (offset ${opts.offset}${opts.limit ? `, limit ${opts.limit}` : ''}).`);
  }

  if (!opts.apply) {
    console.log('\nDry run only — pass --apply to actually write these to the API.');
    return;
  }

  const creds = readCredentials(opts.accountsPath);
  const api = new ApiClient(opts.apiUrl);
  console.log(`\nLogging in as ${creds.login} …`);
  const session = await api.login('login', creds);

  console.log(`\nRegistering ${toRun.length} assets…`);
  let ok = 0;
  const failures: { row: number; sheet: string; error: string }[] = [];
  for (const { sheet, row, dto } of toRun) {
    try {
      const created = await api.call<{ id: string }>(
        `register ${sheet} row ${row}`,
        session,
        'POST',
        '/v1/assets',
        dto,
      );
      await api.call(
        `make ${sheet} row ${row} available`,
        session,
        'PATCH',
        `/v1/assets/${created.id}/lifecycle`,
        {
          status: AssetStatus.AVAILABLE,
          notes: 'CICC partial equipment list import.',
        },
      );
      await api.call(
        `generate QR/barcode for ${sheet} row ${row}`,
        session,
        'POST',
        `/v1/assets/${created.id}/qr`,
      );
      ok += 1;
      console.log(`  ✓ [${sheet} ${row}] ${dto.propertyNumber ?? '(no property number)'} — ${dto.itemDescription}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      failures.push({ row, sheet, error: message });
      console.log(`  ✗ [${sheet} ${row}] ${message}`);
    }
  }

  console.log(`\nDone: ${ok} registered, ${failures.length} failed, ${needsReview.length} held out for review.`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  [${f.sheet} row ${f.row}] ${f.error}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
