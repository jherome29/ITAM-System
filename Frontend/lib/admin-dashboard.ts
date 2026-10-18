import type { AdminDashboardStats } from './api/admin';
import type { HealthStatus } from './api/health';
import type { WatcherRun } from './api/scheduler';

// The Administration Overview's rules and wording, kept out of the component so they can be tested. The
// figures themselves come from GET /api/v1/admin/dashboard-stats (Backend/src/admin/admin.service.ts).

type Decisions = AdminDashboardStats['decisions'];

const plural = (n: number) => (n === 1 ? '' : 's');

// The three Master Admin screens where the administrator decides what a custodian filed for themselves.
const QUEUES: Array<{ key: keyof Decisions; href: string }> = [
  { key: 'returnsIncidents', href: '/master-admin/returns-incidents' },
  { key: 'repairs', href: '/master-admin/repairs' },
  { key: 'requisitions', href: '/master-admin/fulfillment' },
];

export function decisionTotal(d: Decisions): number {
  return d.returnsIncidents + d.repairs + d.requisitions;
}

/** "2 returns & incidents · 1 to fulfil": the empty queues are left out. */
export function decisionDetail(d: Decisions): string {
  const parts = [
    d.returnsIncidents > 0 && `${d.returnsIncidents} return${plural(d.returnsIncidents)} & incident${plural(d.returnsIncidents)}`,
    d.repairs > 0 && `${d.repairs} repair${plural(d.repairs)}`,
    d.requisitions > 0 && `${d.requisitions} to fulfil`,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : 'Nothing is waiting for you';
}

/** Where the card goes: the first queue that has something in it, nowhere when all are empty. */
export function decisionHref(d: Decisions): string | undefined {
  return QUEUES.find((q) => d[q.key] > 0)?.href;
}

export type AttentionTone = 'red' | 'amber';

export interface AttentionItem {
  tone: AttentionTone;
  text: string;
  href?: string;
}

export function buildAttention(stats: AdminDashboardStats, health: HealthStatus | null): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { decisions } = stats;
  if (health && !health.db) {
    items.push({ tone: 'red', text: 'Database unreachable — GET /api/health is reporting the connection down.' });
  }
  // The administrator's own work comes first: a custodian cannot decide their own request, so these wait for them.
  const n = decisions.returnsIncidents;
  if (n > 0) {
    items.push({
      tone: 'amber',
      text: `${n} return / incident request${plural(n)} filed by a custodian ${n === 1 ? 'is' : 'are'} waiting for your decision.`,
      href: QUEUES[0].href,
    });
  }
  const r = decisions.repairs;
  if (r > 0) {
    items.push({
      tone: 'amber',
      text: `${r} repair${plural(r)} of a custodian's own item${plural(r)} ${r === 1 ? 'is' : 'are'} waiting for your decision.`,
      href: QUEUES[1].href,
    });
  }
  const q = decisions.requisitions;
  if (q > 0) {
    items.push({
      tone: 'amber',
      text: `${q} requisition${plural(q)} filed by a custodian ${q === 1 ? 'is' : 'are'} waiting for you to fulfil.`,
      href: QUEUES[2].href,
    });
  }
  if (stats.users.locked > 0) {
    items.push({ tone: 'amber', text: `${stats.users.locked} account${plural(stats.users.locked)} locked out of sign-in.`, href: '/master-admin/users' });
  }
  // Information only: approving is the Approving Officer's job, so the administrator has no screen for it.
  if (stats.requisitions.slaBreached > 0) {
    items.push({ tone: 'red', text: `${stats.requisitions.slaBreached} requisition${plural(stats.requisitions.slaBreached)} past the 24-hour approval SLA.` });
  }
  if (stats.assets.lowStock > 0) {
    items.push({ tone: 'amber', text: `${stats.assets.lowStock} supply line${plural(stats.assets.lowStock)} at or below reorder level.` });
  }
  if (stats.audit.failedLoginsToday >= 10) {
    items.push({ tone: 'amber', text: `${stats.audit.failedLoginsToday} failed login attempts recorded today.`, href: '/master-admin/audit' });
  }
  return items;
}

export type WatcherTone = 'red' | 'amber' | 'neutral' | 'muted';

/**
 * What one background watcher's row says. A watcher counts only the alerts it sent on that run (each requisition,
 * asset or repair is alerted once), so "0" means "nothing new", not "no problems": the live figure goes beside it.
 * `schedule` is how it runs, in words ("every hour", "daily at 7:00 AM"). The record is in memory and empties on
 * every restart, so a watcher that has not run since then is explained, not reported as a fault.
 */
export function watcherResult(run: WatcherRun | undefined, schedule: string): { text: string; tone: WatcherTone } {
  if (!run) return { text: `Runs ${schedule}; not yet since the last restart`, tone: 'muted' };
  if (run.count < 0) return { text: 'Failed — see server log', tone: 'red' };
  return {
    text: `${run.count} new alert${plural(run.count)} sent`,
    tone: run.count > 0 ? 'amber' : 'neutral',
  };
}

/**
 * Who to show beside an audit entry. The watchers file their entries under the person the entry is about (the
 * SLA watcher's reassignment sits under the requester), flagged `systemInitiated`: naming that account would say
 * a person did what the system did by itself.
 */
export function auditActor(entry: { userName?: string | null; metadata?: Record<string, unknown> | null }): string | null {
  if (entry.metadata?.systemInitiated === true) return 'System (automatic)';
  return entry.userName ?? null;
}
