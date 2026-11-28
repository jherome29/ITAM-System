import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Accounts, SeedRole, parseAccounts, REQUIRED_ROLES } from './accounts';
import { ApiClient, ApiError, Session } from './client';
import {
  CustodianRole,
  DEMO_ASSETS,
  DEMO_ASSET_REQUESTS,
  DEMO_ISSUANCES,
  DEMO_PROPERTY_PREFIX,
  DEMO_REQUISITIONS,
  DemoRequisition,
  coverage,
  custodianFor,
  validateScenario,
} from './scenario';
import { dayOffset, requestDate } from './dates';
import { applyPages } from './seed-pages';
import {
  PAGES_ASSETS,
  PAGES_STEPS,
  pagesCoverage,
  validatePages,
} from './scenario-pages';
import {
  AssetRequestType,
  AssetStatus,
  AssetType,
  UserRole,
} from '../../../packages/shared/src/enums';

// Pilot demo-data seeder. Replays the scenarios in test/demo-seed through the real
// API as the real roles, so the data is indistinguishable from normal use:
// numbering, notifications, audit trail and COA forms all come from the app.
//
//   npx ts-node test/demo-seed/seed.ts                     # dry run — prints the plan
//   npx ts-node test/demo-seed/seed.ts --apply             # writes it
//   npx ts-node test/demo-seed/seed.ts --scenario pages    # the second round (see below)
//
// `base` (scenario.ts) fills the requisition and incident queues. `pages`
// (scenario-pages.ts) goes on top of it and fills the pages `base` leaves bare:
// Maintenance & Repair, My Assigned Assets, My Requisitions, the Admin's
// escalation queues, transferred/disposed assets. Run `base` first.
//
// See README.md in this folder for the accounts file and the safety rules.

const DEFAULT_API = 'http://localhost:3001/api';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SCENARIOS = ['base', 'pages'] as const;
type ScenarioName = (typeof SCENARIOS)[number];

interface Options {
  apply: boolean;
  allowRemote: boolean;
  apiUrl: string;
  accountsPath: string;
  scenario: ScenarioName;
  backupApprover?: string;
}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv): Options {
  const flag = (name: string) => argv.includes(`--${name}`);
  const value = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  // Only an absent flag means "base". `--scenario` with a missing or mistyped value must
  // stop the run rather than quietly seed the wrong scenario into a shared database.
  const scenario = flag('scenario') ? value('scenario') : 'base';
  if (!scenario || !(SCENARIOS as readonly string[]).includes(scenario)) {
    throw new Error(
      `Unknown --scenario "${scenario ?? ''}". Choose one of: ${SCENARIOS.join(', ')}.`,
    );
  }
  return {
    apply: flag('apply'),
    allowRemote: flag('allow-remote'),
    apiUrl: value('api') ?? env.DEMO_SEED_API_URL ?? DEFAULT_API,
    accountsPath: resolve(
      value('accounts') ??
        env.DEMO_SEED_ACCOUNTS ??
        'test/demo-seed/accounts.local.json',
    ),
    scenario: scenario as ScenarioName,
    backupApprover: value('backup-approver'),
  };
}

// Messages here never repeat the path: it comes from an environment variable,
// which is treated as sensitive, and a log line adds nothing the operator
// doesn't already know.
export function loadAccounts(path: string): Accounts {
  let text: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- operator-supplied CLI path to their own credentials file
    text = readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      'Cannot read the accounts file. Copy accounts.example.json to ' +
        'accounts.local.json and fill it in, or point --accounts / ' +
        'DEMO_SEED_ACCOUNTS at your file (see README.md).',
    );
  }
  try {
    return parseAccounts(JSON.parse(text));
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error('The accounts file is not valid JSON.');
    }
    throw e;
  }
}

// ── Plan (dry run) ───────────────────────────────────────────────────────────

const count = <T>(items: T[], pick: (i: T) => string) =>
  Object.entries(
    items.reduce<Record<string, number>>((acc, i) => {
      acc[pick(i)] = (acc[pick(i)] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([k, n]) => `${n} ${k}`)
    .join(', ');

function printPagesPlan(opts: Options) {
  const c = pagesCoverage();
  console.log('Page-coverage plan (nothing has been sent):\n');
  console.log(`  target API     ${opts.apiUrl}`);
  console.log('  accounts file  (set by --accounts / DEMO_SEED_ACCOUNTS)');
  console.log(`  acts as        ${REQUIRED_ROLES.join(', ')}\n`);
  console.log(
    `  assets          ${PAGES_ASSETS.length}  (${count(PAGES_ASSETS, (a) => a.dto.assetType)})`,
  );
  console.log(
    `  steps           ${PAGES_STEPS.length}  (${count(PAGES_STEPS, (s) => s.do)})\n`,
  );
  console.log('  What each page will show:');
  const lines: Array<[string, string]> = [
    [
      'Maintenance & Repair',
      `${c.openRepairs.ict} ICT + ${c.openRepairs.fixed} Fixed open (${c.openRepairs.inHouse} in-house, ` +
        `${c.openRepairs.external} external, ${c.openRepairs.overdue} overdue, ${c.openRepairs.withLoaner} with a loaner); ` +
        `history: ${c.closedRepairs.repaired} repaired, ${c.closedRepairs.unrepairable} unrepairable, ` +
        `${c.repeatRepairAssets} item(s) repaired repeatedly`,
    ],
    [
      'My Assigned Assets',
      Object.entries(c.holders)
        .map(([role, n]) => `${role} ${n}`)
        .join(', '),
    ],
    [
      'My Requisitions',
      Object.entries(c.ownRequisitions)
        .map(([role, n]) => `${role} ${n}`)
        .join(', '),
    ],
    [
      'Master Admin escalations',
      `${c.custodianRequests.waiting} custodian request(s) waiting, ${c.custodianRequests.decided} decided; ` +
        `${c.openRepairs.heldByCustodian} open repair(s) on a custodian's own item`,
    ],
    [
      'Dashboards / Custody',
      `${c.transferred} transferred, ${c.disposed} disposed; ${c.locations} offices for the physical count`,
    ],
    [
      'Replacement Validation',
      `${c.completedReplacements.ict} ICT + ${c.completedReplacements.fixed} Fixed replacement(s) completed`,
    ],
  ];
  for (const [page, text] of lines) {
    console.log(`    ${page.padEnd(26)}${text}`);
  }
  console.log();
  console.log(
    "Also sets the Approving Officer's backup approver (the only other active supervisor, or --backup-approver <employee ID>).",
  );
  console.log(
    'Re-run with --apply --scenario pages to write this. Logging in signs out any',
  );
  console.log(
    'existing session on each of the accounts above (one session per account).',
  );
}

function printPlan(opts: Options) {
  const c = coverage();

  console.log('Demo data plan (nothing has been sent):\n');
  console.log(`  target API     ${opts.apiUrl}`);
  console.log('  accounts file  (set by --accounts / DEMO_SEED_ACCOUNTS)');
  console.log(`  acts as        ${REQUIRED_ROLES.join(', ')}\n`);
  console.log(
    `  assets          ${DEMO_ASSETS.length}  (${count(DEMO_ASSETS, (a) => a.dto.assetType)})`,
  );
  console.log(`  issued to demo employee  ${DEMO_ISSUANCES.length}`);
  console.log(
    `  requisitions    ${DEMO_REQUISITIONS.length}  (${count(DEMO_REQUISITIONS, (r) => r.outcome)})`,
  );
  console.log(
    `  holder requests ${DEMO_ASSET_REQUESTS.length}  (${count(DEMO_ASSET_REQUESTS, (r) => r.outcome)})\n`,
  );
  console.log('  What each role will find:');
  const lines: Array<[string, string]> = [
    [
      'Approving Officer',
      `${c.supervisorPending} to decide, ${c.supervisorDecided} already decided`,
    ],
    [
      'IT Asset Custodian',
      `${c.itFulfilment} to fulfil (+${c.onHold} on hold), ${c.itAssetRequests} return/repair/incident request(s); ` +
        `replacement: ${c.it.replacementRequests} request(s), ${c.it.replacementCandidates} candidate(s); ` +
        `${c.it.disposalCandidates} item(s) written off`,
    ],
    [
      'Property Custodian',
      `${c.pcFulfilment} to fulfil, ${c.pcAssetRequests} return/repair/incident request(s)`,
    ],
    [
      'Property Custodian review pages',
      `replacement: ${c.pc.replacementRequests} request(s), ${c.pc.replacementCandidates} candidate(s); ` +
        `${c.pc.disposalCandidates} item(s) in disposal review`,
    ],
    [
      'Alerts',
      `${c.lowStockSupplies} low-stock supply line(s), ${c.overdueLoans} overdue loan(s)`,
    ],
  ];
  for (const [role, text] of lines) {
    console.log(`    ${role.padEnd(20)}${text}`);
  }
  console.log();
  console.log(
    'Re-run with --apply to write this. Logging in signs out any existing',
  );
  console.log(
    'session on each of the accounts above (one session per account).',
  );
}

// ── Apply ────────────────────────────────────────────────────────────────────

interface Asset {
  id: string;
  assetType: AssetType;
}
interface Requisition {
  id: string;
  requestNumber: string;
  items: Array<{ id: string }>;
}
interface AssetRequest {
  id: string;
  requestNumber: string;
}

let steps = 0;
const done = (label: string) => {
  steps += 1;
  console.log(`  ✓ ${label}`);
};

/** Remote-host guard, then one login per role (each signs out that account's earlier sessions). */
async function connect(opts: Options) {
  const host = new URL(opts.apiUrl).hostname;
  if (!LOCAL_HOSTS.has(host) && !opts.allowRemote) {
    throw new Error(
      `${host} is not a local address. Pass --allow-remote if you really mean to seed that server.`,
    );
  }
  const accounts = loadAccounts(opts.accountsPath);
  const api = new ApiClient(opts.apiUrl);

  console.log(`Seeding ${opts.apiUrl}\n\nLogging in…`);
  const session = {} as Record<SeedRole, Session>;
  for (const role of REQUIRED_ROLES) {
    session[role] = await api.login(`login ${role}`, accounts[role]);
    done(`logged in as ${role}`);
  }
  return { api, session };
}

async function applyPagesScenario(opts: Options) {
  const { api, session } = await connect(opts);
  await applyPages(api, session, done, { backupApprover: opts.backupApprover });
  console.log(
    `\nDone — ${steps} steps. Sign in as each role to see its pages filled.`,
  );
}

async function applyBase(opts: Options) {
  const { api, session } = await connect(opts);
  const employee = session[UserRole.EMPLOYEE];
  const custodian = (role: CustodianRole) => session[role];

  // Refuse to stack a second copy on top of an earlier run.
  for (const role of [
    UserRole.IT_PERSONNEL,
    UserRole.PROPERTY_CUSTODIAN,
  ] as const) {
    const found = await api.call<{ total: number }>(
      `check existing demo assets (${role})`,
      session[role],
      'GET',
      `/v1/assets?search=${encodeURIComponent(DEMO_PROPERTY_PREFIX)}&limit=1`,
    );
    if (found.total > 0) {
      throw new Error(
        `Demo data is already present (${found.total} ${DEMO_PROPERTY_PREFIX} assets visible to ${role}). Nothing was written.`,
      );
    }
  }

  // 1 ── Assets: register, then make available for issue ────────────────────
  console.log('\nRegistering assets…');
  const assets = new Map<string, Asset>();
  for (const { key, dto } of DEMO_ASSETS) {
    const as = custodian(custodianFor(dto.assetType));
    const created = await api.call<Asset>(
      `register ${key}`,
      as,
      'POST',
      '/v1/assets',
      dto,
    );
    await api.call(
      `make ${key} available`,
      as,
      'PATCH',
      `/v1/assets/${created.id}/lifecycle`,
      {
        status: AssetStatus.AVAILABLE,
        notes: 'Demo data: received and ready for issue.',
      },
    );
    assets.set(key, { id: created.id, assetType: dto.assetType });
    done(`${key} (${dto.propertyNumber})`);
  }
  const asset = (key: string) => assets.get(key)!;

  // 2 ── Issue the units the demo employee will hold ────────────────────────
  console.log('\nIssuing assets to the demo employee…');
  const issue = (key: string, expectedReturnInDays?: number) => {
    const target = asset(key);
    return api.call(
      `issue ${key}`,
      custodian(custodianFor(target.assetType)),
      'PATCH',
      `/v1/assets/${target.id}/lifecycle`,
      {
        status: AssetStatus.ISSUED,
        employeeId: employee.employeeId,
        notes: 'Demo data: issued for use.',
        ...(expectedReturnInDays === undefined
          ? {}
          : { expectedReturnDate: dayOffset(expectedReturnInDays) }),
      },
    );
  };
  for (const i of DEMO_ISSUANCES) {
    await issue(i.asset, i.expectedReturnInDays);
    done(
      i.asset +
        (i.expectedReturnInDays !== undefined
          ? ` (loan due ${dayOffset(i.expectedReturnInDays)})`
          : ''),
    );
  }

  // 3 ── Requisitions ───────────────────────────────────────────────────────
  console.log('\nFiling requisitions…');
  const supervisor = session[UserRole.SUPERVISOR];
  for (const r of DEMO_REQUISITIONS) {
    const created = await api.call<Requisition>(
      `submit ${r.key}`,
      employee,
      'POST',
      '/v1/requisitions',
      {
        requisitionType: r.type,
        justification: r.justification,
        requiredDate: dayOffset(r.requiredInDays),
        items: r.items,
        ...(r.replaces ? { replacedAssetId: asset(r.replaces).id } : {}),
      },
    );
    await decideAndFulfil(api, r, created, supervisor, session, asset, issue);
    done(`${created.requestNumber} ${r.key} → ${r.outcome}`);
  }

  // 4 ── Holder requests: returns, repairs, incidents ───────────────────────
  console.log('\nFiling return / repair / incident requests…');
  for (const r of DEMO_ASSET_REQUESTS) {
    const target = asset(r.asset);
    const as = custodian(custodianFor(target.assetType));
    const form = new FormData();
    form.set('assetId', target.id);
    form.set('type', r.type);
    form.set('preferredDate', requestDate(r.type, r.preferredInDays));
    form.set('details', r.details);
    const created = await api.call<AssetRequest>(
      `file ${r.key}`,
      employee,
      'POST',
      '/v1/asset-requests',
      form,
    );
    const path = `/v1/asset-requests/${created.id}`;
    if (r.outcome === 'rejected') {
      await api.call(`reject ${r.key}`, as, 'PATCH', `${path}/reject`, {
        reason: r.reason,
      });
    } else if (r.outcome !== 'submitted') {
      await api.call(`approve ${r.key}`, as, 'PATCH', `${path}/approve`, {
        ...(r.handoverInDays === undefined
          ? {}
          : { handoverDate: dayOffset(r.handoverInDays) }),
        ...(r.outcome === 'approved' && r.notes ? { notes: r.notes } : {}),
      });
      if (r.outcome === 'completed') {
        await api.call(`complete ${r.key}`, as, 'PATCH', `${path}/complete`, {
          ...(r.type === AssetRequestType.DAMAGE
            ? { outcome: r.damageOutcome }
            : {}),
          ...(r.notes ? { notes: r.notes } : {}),
        });
      }
    }
    done(`${created.requestNumber} ${r.key} → ${r.outcome}`);
  }

  // 5 ── Run the background watchers once so the alerts exist straight away ─
  console.log('\nRunning the notification watchers once…');
  await api.call(
    'run notification checks',
    session[UserRole.SYSTEM_ADMIN],
    'POST',
    '/v1/notifications/run-checks',
  );
  done('low-stock, overdue-return and approval alerts raised');

  console.log(`\nDone — ${steps} steps. Sign in as each role to see its data.`);
}

/** Supervisor decision, then the custodian's hold / fulfilment, per the scenario. */
async function decideAndFulfil(
  api: ApiClient,
  r: DemoRequisition,
  created: Requisition,
  supervisor: Session,
  session: Record<SeedRole, Session>,
  asset: (key: string) => Asset,
  issue: (key: string) => Promise<unknown>,
) {
  const path = `/v1/requisitions/${created.id}`;
  if (r.outcome === 'pending') return;
  if (r.outcome === 'rejected') {
    await api.call(`reject ${r.key}`, supervisor, 'POST', `${path}/reject`, {
      comments: r.comments,
    });
    return;
  }
  await api.call(`approve ${r.key}`, supervisor, 'POST', `${path}/approve`, {
    comments: r.comments,
  });
  const custodian = session[custodianFor(r.items[0].assetType)];
  if (r.outcome === 'on_hold') {
    await api.call(`hold ${r.key}`, custodian, 'POST', `${path}/hold`, {
      reason: r.holdReason,
    });
  } else if (r.outcome === 'fulfilled') {
    const { notes, assets, issue: handOver } = r.fulfil!;
    await api.call(`fulfil ${r.key}`, custodian, 'POST', `${path}/fulfill`, {
      notes,
      fulfilledItems: assets.map((key, i) => ({
        requisitionItemId: created.items[i].id,
        assetId: asset(key).id,
      })),
    });
    if (handOver) for (const key of assets) await issue(key);
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  let opts: Options;
  try {
    opts = parseArgs(process.argv.slice(2), process.env);
  } catch (e) {
    console.error(`✖ ${(e as Error).message}`);
    process.exitCode = 1;
    return;
  }
  const pages = opts.scenario === 'pages';
  const problems = pages ? validatePages() : validateScenario();
  if (problems.length > 0) {
    console.error(
      `The ${opts.scenario} demo scenario is invalid:\n  - ` +
        problems.join('\n  - '),
    );
    process.exitCode = 1;
    return;
  }
  if (!opts.apply) {
    if (pages) printPagesPlan(opts);
    else printPlan(opts);
    return;
  }
  try {
    await (pages ? applyPagesScenario(opts) : applyBase(opts));
  } catch (e) {
    console.error(`\n✖ ${(e as Error).message}`);
    if (e instanceof ApiError) {
      console.error(
        `  Stopped after ${steps} successful steps. Rows already written stay in the database;\n` +
          '  see README.md ("If a run stops part-way") before running again.',
      );
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
