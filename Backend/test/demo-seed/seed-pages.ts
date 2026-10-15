import { SeedRole } from './accounts';
import { ApiClient, Session } from './client';
import { dayOffset } from './dates';
import { custodianFor } from './scenario';
import {
  Holder,
  PAGES_ASSETS,
  PAGES_PROPERTY_PREFIX,
  PAGES_STEPS,
  ServiceDetails,
  Step,
} from './scenario-pages';
import {
  AssetRequestType,
  AssetStatus,
  AssetType,
  UserRole,
} from '../../../packages/shared/src/enums';

// Replays scenario-pages.ts through the real API, as the right role at each step.
// Like the base seeder it stops at the first failed step instead of piling more writes on
// a broken one, and refuses to run twice.

type Sessions = Record<SeedRole, Session>;

interface CreatedAsset {
  id: string;
  assetType: AssetType;
}
interface UserRow {
  id: string;
  employeeId: string;
  role: string;
  isActive: boolean;
}
interface RepairRow {
  id: string;
  completedAt: string | null;
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

export interface PagesOptions {
  /** Employee ID of the account to name as the officer's backup approver. */
  backupApprover?: string;
}

export async function applyPages(
  api: ApiClient,
  session: Sessions,
  done: (label: string) => void,
  options: PagesOptions = {},
): Promise<void> {
  const admin = session[UserRole.SYSTEM_ADMIN];
  const custodian = (type: AssetType) => session[custodianFor(type)];

  // The roles the seeder is logged in as. The Property Officer and Management only ever
  // *hold* assets here, so they are looked up in the directory instead.
  const login: Partial<Record<Holder, Session>> = {
    employee: session[UserRole.EMPLOYEE],
    supervisor: session[UserRole.SUPERVISOR],
    it_personnel: session[UserRole.IT_PERSONNEL],
    property_custodian: session[UserRole.PROPERTY_CUSTODIAN],
    system_admin: admin,
  };
  const as = (holder: Holder): Session => {
    const s = login[holder];
    if (!s) throw new Error(`The seeder is not logged in as ${holder}.`);
    return s;
  };
  const directory = async (role: string) =>
    (
      await api.call<{ data: UserRow[] }>(
        `look up ${role} accounts`,
        admin,
        'GET',
        `/v1/users?role=${encodeURIComponent(role)}&limit=100`,
      )
    ).data.filter((u) => u.isActive);

  // Everything below that reads is resolved BEFORE the first write, and an ambiguous
  // answer stops the run: guessing which account should hold the assets (or be the
  // backup approver) in a shared database is not recoverable, since audit rows are permanent.
  const idList = (users: UserRow[]) =>
    users.map((u) => u.employeeId).join(', ');
  const employeeIdOf = new Map<Holder, string>();
  for (const holder of new Set(
    PAGES_STEPS.flatMap((s) => (s.do === 'issue' ? [s.to] : [])),
  )) {
    const loggedIn = login[holder]?.employeeId;
    if (loggedIn) {
      employeeIdOf.set(holder, loggedIn);
      continue;
    }
    const accounts = await directory(holder);
    if (accounts.length !== 1) {
      throw new Error(
        accounts.length === 0
          ? `There is no active ${holder} account to issue to. Nothing was written.`
          : `There are ${accounts.length} active ${holder} accounts (${idList(accounts)}), so the seeder cannot tell which one should hold the assets. Nothing was written.`,
      );
    }
    employeeIdOf.set(holder, accounts[0].employeeId);
  }

  const backups = new Map<Holder, UserRow>();
  for (const step of PAGES_STEPS) {
    if (step.do !== 'backupApprover') continue;
    const officer = as(step.officer);
    const others = (await directory(UserRole.SUPERVISOR)).filter(
      (u) => u.id !== officer.userId,
    );
    const chosen = options.backupApprover
      ? others.filter((u) => u.employeeId === options.backupApprover)
      : others;
    if (chosen.length !== 1) {
      throw new Error(
        chosen.length === 0
          ? `There is no other active supervisor${options.backupApprover ? ' with that employee ID' : ''} to be the backup approver. Nothing was written.`
          : `There are ${chosen.length} other active supervisors (${idList(chosen)}); pass --backup-approver <employee ID> to pick one. Nothing was written.`,
      );
    }
    backups.set(step.officer, chosen[0]);
  }

  // Refuse to stack a second copy on top of an earlier run.
  for (const role of [
    UserRole.IT_PERSONNEL,
    UserRole.PROPERTY_CUSTODIAN,
  ] as const) {
    const found = await api.call<{ total: number }>(
      `check existing page demo assets (${role})`,
      session[role],
      'GET',
      `/v1/assets?search=${encodeURIComponent(PAGES_PROPERTY_PREFIX)}&limit=1`,
    );
    if (found.total > 0) {
      throw new Error(
        `The page demo data is already present (${found.total} ${PAGES_PROPERTY_PREFIX} assets visible to ${role}). Nothing was written.`,
      );
    }
  }

  // 1 ── Assets: register, then make available ──────────────────────────────
  console.log('\nRegistering assets…');
  const assets = new Map<string, CreatedAsset>();
  for (const { key, dto } of PAGES_ASSETS) {
    const who = custodian(dto.assetType);
    const created = await api.call<CreatedAsset>(
      `register ${key}`,
      who,
      'POST',
      '/v1/assets',
      dto,
    );
    await api.call(
      `make ${key} available`,
      who,
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
  const asset = (key: string) => {
    const a = assets.get(key);
    if (!a) throw new Error(`Unknown asset "${key}".`);
    return a;
  };
  const lifecycle = (label: string, who: Session, key: string, body: object) =>
    api.call(
      label,
      who,
      'PATCH',
      `/v1/assets/${asset(key).id}/lifecycle`,
      body,
    );

  const openRepairOf = async (
    label: string,
    who: Session,
    key: string,
  ): Promise<RepairRow> => {
    const repairs = await api.call<RepairRow[]>(
      label,
      who,
      'GET',
      `/v1/repairs/asset/${asset(key).id}`,
    );
    const open = repairs.find((r) => !r.completedAt);
    if (!open)
      throw new Error(`${label}: no open repair was found for ${key}.`);
    return open;
  };
  const recordService = (
    who: Session,
    repair: RepairRow,
    key: string,
    s: ServiceDetails,
  ) =>
    api.call(
      `record service details for ${key}`,
      who,
      'PATCH',
      `/v1/repairs/${repair.id}`,
      {
        serviceType: s.type,
        ...(s.provider ? { serviceProvider: s.provider } : {}),
        ...(s.dueInDays === undefined
          ? {}
          : { expectedCompletionDate: dayOffset(s.dueInDays) }),
      },
    );

  // 2 ── The steps, in order ────────────────────────────────────────────────
  console.log('\nRunning the scenarios…');
  const run = async (step: Step): Promise<void> => {
    switch (step.do) {
      case 'backupApprover': {
        const backup = backups.get(step.officer)!;
        await api.call(
          'set the backup approver',
          admin,
          'PATCH',
          `/v1/users/${as(step.officer).userId}`,
          {
            alternateApproverId: backup.id,
          },
        );
        done(`backup approver for ${step.officer} is ${backup.employeeId}`);
        return;
      }

      case 'issue': {
        await lifecycle(
          `issue ${step.asset}`,
          custodian(asset(step.asset).assetType),
          step.asset,
          {
            status: AssetStatus.ISSUED,
            employeeId: employeeIdOf.get(step.to),
            notes: 'Demo data: issued for use.',
            ...(step.dueInDays === undefined
              ? {}
              : { expectedReturnDate: dayOffset(step.dueInDays) }),
          },
        );
        done(`${step.asset} → ${step.to}`);
        return;
      }

      case 'repair': {
        const who = custodian(asset(step.asset).assetType);
        await lifecycle(`send ${step.asset} to repair`, who, step.asset, {
          status: AssetStatus.UNDER_REPAIR,
          notes: step.problem,
        });
        const repair = await openRepairOf(
          `find the repair of ${step.asset}`,
          who,
          step.asset,
        );
        if (step.service)
          await recordService(who, repair, step.asset, step.service);
        if (step.loaner) {
          await api.call(
            `lend ${step.loaner} while ${step.asset} is repaired`,
            who,
            'POST',
            `/v1/repairs/${repair.id}/loaner`,
            {
              assetId: asset(step.loaner).id,
              ...(step.loanerReturnInDays === undefined
                ? {}
                : { expectedReturnDate: dayOffset(step.loanerReturnInDays) }),
            },
          );
        }
        if (step.finish) {
          await api.call(
            `close the repair of ${step.asset}`,
            who,
            'POST',
            `/v1/repairs/${repair.id}/complete`,
            {
              outcome: step.finish.outcome,
              actionTaken: step.finish.action,
              ...(step.finish.findings
                ? { findings: step.finish.findings }
                : {}),
              ...(step.finish.returnToStock ? { returnToStock: true } : {}),
            },
          );
        }
        done(
          `${step.asset} repair → ${step.finish ? step.finish.outcome : 'in progress'}`,
        );
        return;
      }

      case 'requisition': {
        const created = await api.call<Requisition>(
          `submit ${step.key}`,
          as(step.by),
          'POST',
          '/v1/requisitions',
          {
            requisitionType: step.type,
            justification: step.justification,
            requiredDate: dayOffset(step.requiredInDays),
            items: step.items,
            ...(step.replaces
              ? { replacedAssetId: asset(step.replaces).id }
              : {}),
          },
        );
        if (step.outcome === 'fulfilled') {
          const path = `/v1/requisitions/${created.id}`;
          await api.call(
            `approve ${step.key}`,
            as('supervisor'),
            'POST',
            `${path}/approve`,
            {
              comments: 'Approved.',
            },
          );
          await api.call(
            `fulfil ${step.key}`,
            custodian(step.items[0].assetType),
            'POST',
            `${path}/fulfill`,
            {
              notes: 'Replacement issued; the old unit was collected.',
              fulfilledItems: [
                {
                  requisitionItemId: created.items[0].id,
                  assetId: asset(step.fulfilWith!).id,
                },
              ],
            },
          );
        }
        done(
          `${created.requestNumber} ${step.key} (${step.by}) → ${step.outcome}`,
        );
        return;
      }

      case 'assetRequest': {
        const target = asset(step.asset);
        const form = new FormData();
        form.set('assetId', target.id);
        form.set('type', step.type);
        form.set('preferredDate', dayOffset(step.preferredInDays));
        form.set('details', step.details);
        const created = await api.call<AssetRequest>(
          `file ${step.key}`,
          as(step.by),
          'POST',
          '/v1/asset-requests',
          form,
        );
        const decider =
          step.decider === 'admin' ? admin : custodian(target.assetType);
        const path = `/v1/asset-requests/${created.id}`;
        if (step.outcome !== 'submitted') {
          await api.call(
            `approve ${step.key}`,
            decider,
            'PATCH',
            `${path}/approve`,
            {
              ...(step.handoverInDays === undefined
                ? {}
                : { handoverDate: dayOffset(step.handoverInDays) }),
              ...(step.notes && step.outcome === 'approved'
                ? { notes: step.notes }
                : {}),
            },
          );
        }
        if (step.outcome === 'completed') {
          await api.call(
            `complete ${step.key}`,
            decider,
            'PATCH',
            `${path}/complete`,
            {
              ...(step.notes ? { notes: step.notes } : {}),
            },
          );
          if (step.service && step.type === AssetRequestType.REPAIR) {
            const repair = await openRepairOf(
              `find the repair of ${step.asset}`,
              decider,
              step.asset,
            );
            await recordService(decider, repair, step.asset, step.service);
          }
        }
        done(
          `${created.requestNumber} ${step.key} (${step.by}, decided by ${step.decider}) → ${step.outcome}`,
        );
        return;
      }

      case 'transfer':
        await lifecycle(
          `transfer ${step.asset}`,
          custodian(asset(step.asset).assetType),
          step.asset,
          {
            status: AssetStatus.TRANSFERRED,
            toLocation: step.toLocation,
            notes: 'Demo data: transferred to another unit.',
          },
        );
        done(`${step.asset} → transferred`);
        return;

      case 'dispose': {
        const who = custodian(asset(step.asset).assetType);
        await lifecycle(`flag ${step.asset} for disposal`, who, step.asset, {
          status: AssetStatus.FLAGGED_FOR_DISPOSAL,
          notes: step.notes,
        });
        await lifecycle(`dispose ${step.asset}`, who, step.asset, {
          status: AssetStatus.DISPOSED,
          notes: 'Demo data: disposed through the COA procedure.',
        });
        done(`${step.asset} → disposed`);
        return;
      }
    }
  };
  for (const step of PAGES_STEPS) await run(step);

  // 3 ── Run the background watchers so the repair-overdue alert exists now ──
  console.log('\nRunning the notification watchers once…');
  await api.call(
    'run notification checks',
    admin,
    'POST',
    '/v1/notifications/run-checks',
  );
  done('overdue-repair and other alerts raised');
}
