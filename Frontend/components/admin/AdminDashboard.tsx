'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, Boxes, CheckCircle2, ClipboardCheck, Server, Users } from 'lucide-react';
import { adminApi, type AdminDashboardStats } from '@/lib/api/admin';
import { healthApi, type HealthStatus } from '@/lib/api/health';
import { systemConfigApi, type SystemConfig } from '@/lib/api/systemConfig';
import { reportsApi, type KpiData } from '@/lib/api/reports';
import { auditApi, type AuditLog } from '@/lib/api/audit';
import { auditEventLabel } from '@/lib/audit-label';
import { attentionPanelState } from '@/lib/admin-attention';
import { auditActor, buildAttention, decisionDetail, decisionHref, decisionTotal, watcherResult, type WatcherTone } from '@/lib/admin-dashboard';
import { schedulerApi, type WatcherName, type WatcherStatus, type WatcherSweep } from '@/lib/api/scheduler';
import { AdminPageHeader, MetricCard, Panel, StatusChip, type AdminTone } from './AdminUi';
import { formatDateTime, formatTime } from '@/lib/dates';
import { roleLabel } from '@/lib/assets/asset-history';

// Backend UserRole enum value -> the label already used on the Users & Roles
// screens (AdminIdentityPages USER_ROLE_OPTIONS). Kept local so the dashboard
// has no reason to import from that screen.
const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  supervisor: 'Supervisor',
  it_personnel: 'IT Personnel',
  system_admin: 'System Administrator',
  management: 'Management',
  property_custodian: 'Property Custodian',
};
const ROLE_ORDER = Object.keys(ROLE_LABELS);
// The retired Property Officer role is listed only while an account still holds it: that is a
// leftover for the administrator to move to Property Custodian.
const RETIRED_ROLE_LABELS: Record<string, string> = { property_officer: 'Property Officer (retired)' };

function formatUptime(seconds: number): string {
  if (seconds <= 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const SWEEP_TRIGGER_LABEL: Record<WatcherSweep['trigger'], string> = {
  'hourly-cron': 'hourly cron',
  'daily-cron': 'daily cron',
  manual: 'manual run',
};

// The scheduler holds this in memory per instance, so "no sweep recorded yet"
// just means none has run since the backend last started.
function formatSweep(sweep: WatcherSweep | null): string {
  if (!sweep) return 'No sweep recorded yet';
  return `${formatDateTime(sweep.at)} · ${SWEEP_TRIGGER_LABEL[sweep.trigger]}`;
}

// Every watcher, in run order. `live` is the figure right now, because the watcher itself only reports the NEW
// alerts it sent (each one goes out once): "0 new alerts sent" next to "11 past SLA now" is not a contradiction.
const WATCHERS: Array<{ name: WatcherName; label: string; schedule: string; live?: (stats: AdminDashboardStats) => string }> = [
  { name: 'slaBreaches', label: 'SLA breaches', schedule: 'every hour', live: (s) => `${s.requisitions.slaBreached} past SLA now` },
  { name: 'pendingNudges', label: 'Pending-approval reminders', schedule: 'every hour' },
  { name: 'overdueReturns', label: 'Overdue returns', schedule: 'daily at 7:00 AM' },
  { name: 'lowStock', label: 'Low stock', schedule: 'daily at 7:00 AM', live: (s) => `${s.assets.lowStock} at or below reorder level now` },
  { name: 'overdueRepairs', label: 'Overdue repairs', schedule: 'daily at 7:00 AM' },
];

const WATCHER_TONE: Record<WatcherTone, string> = {
  red: 'text-red-700',
  amber: 'text-amber-700',
  neutral: 'text-slate-700',
  muted: 'text-slate-500',
};

function WatcherRows({ status, stats }: Readonly<{ status: WatcherStatus | null; stats: AdminDashboardStats | null }>) {
  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
      {WATCHERS.map((w) => {
        const run = status?.watchers?.[w.name];
        const result = watcherResult(run, w.schedule);
        const live = stats && w.live ? w.live(stats) : null;
        return (
          <li key={w.name} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
            <span>
              <span className="font-semibold text-slate-800">{w.label}</span>
              {run && <span className="block text-slate-500">{`${formatDateTime(run.at)} · ${SWEEP_TRIGGER_LABEL[run.trigger]}`}</span>}
            </span>
            <span className="text-right">
              <span className={`block font-semibold ${WATCHER_TONE[result.tone]}`}>{result.text}</span>
              {live && <span className="block text-slate-500">{live}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// Most recent updatedAt across every runtime-config key, or a "still on
// defaults" note when nothing has been persisted.
function latestConfigChange(meta: SystemConfig['meta']): string {
  const times = Object.values(meta ?? {})
    .map((entry) => entry.updatedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime());
  if (times.length === 0) return 'never — built-in defaults in effect';
  return formatDateTime(new Date(Math.max(...times)).toISOString());
}

const attentionRowClass: Record<AdminTone, string> = {
  red: 'border-l-red-500',
  amber: 'border-l-amber-500',
  green: 'border-l-emerald-500',
  blue: 'border-l-blue-500',
  slate: 'border-l-slate-400',
};

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus | null>(null);
  const [runningChecks, setRunningChecks] = useState(false);
  const [checksError, setChecksError] = useState('');
  const [loading, setLoading] = useState(true);
  const sweep = watcherStatus?.lastSweep ?? null;

  // Runs every watcher now (alerts go out as they would on schedule), then
  // re-reads the status so each row shows this run.
  const runChecks = async () => {
    setRunningChecks(true);
    setChecksError('');
    try {
      await schedulerApi.runChecks();
      setWatcherStatus((await schedulerApi.watcherStatus()).data);
    } catch {
      setChecksError('The checks could not be run. Please try again.');
    } finally {
      setRunningChecks(false);
    }
  };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      adminApi.dashboardStats(),
      healthApi.check(),
      systemConfigApi.get(),
      reportsApi.kpi(),
      auditApi.list(1, 6),
      schedulerApi.watcherStatus(),
    ]).then(([s, h, c, k, a, w]) => {
      if (cancelled) return;
      // No `decisions` means an older backend is still answering (the two services deploy separately): say the
      // figures are unavailable rather than show a wrong "nothing waiting for you".
      if (s.status === 'fulfilled' && s.value.data?.decisions) setStats(s.value.data);
      else setFailed(true);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (c.status === 'fulfilled') setConfig(c.value.data);
      if (k.status === 'fulfilled') setKpi(k.value.data);
      if (a.status === 'fulfilled') setRecentLogs(a.value.data.data);
      if (w.status === 'fulfilled') setWatcherStatus(w.value.data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const platformValue = health ? (health.db ? 'Operational' : 'Degraded') : 'Unknown';
  const platformTone: AdminTone = health ? (health.db ? 'green' : 'red') : 'slate';
  const attention = stats ? buildAttention(stats, health) : [];
  const panel = attentionPanelState(loading, stats !== null, attention.length);
  const roleMax = stats ? Math.max(1, ...Object.values(stats.users.byRole)) : 1;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Administration Overview"
        detail="Live account, requisition, asset, and platform figures — every number below is read straight from the system of record."
        action={stats ? <span className="text-xs text-slate-500">Updated {formatTime(stats.generatedAt)}</span> : undefined}
      />

      {failed && (
        <section className="rounded-lg border border-red-200 border-l-4 border-l-red-500 bg-white px-4 py-3 text-sm text-red-800 shadow-sm">
          Could not load dashboard statistics. The admin API may be unreachable — try refreshing.
        </section>
      )}

      <section aria-label="Items needing attention" className="space-y-2">
        {panel === 'loading' ? (
          <div className="h-16 animate-pulse rounded-lg border border-slate-200 bg-white" />
        ) : panel === 'unavailable' ? null /* the failure banner above says why; never claim "all clear" without the numbers */ : panel === 'clear' ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 border-l-4 border-l-emerald-500 bg-white px-4 py-3 shadow-sm">
            <CheckCircle2 className="h-5 w-5 flex-none text-emerald-600" />
            <p className="text-sm font-semibold text-slate-900">No administrative items need attention right now.</p>
          </div>
        ) : (
          attention.map((item) => (
            <div key={item.text} className={`flex flex-col gap-2 rounded-lg border border-slate-200 border-l-4 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${attentionRowClass[item.tone]}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`mt-0.5 h-5 w-5 flex-none ${item.tone === 'red' ? 'text-red-600' : 'text-amber-600'}`} />
                <p className="text-sm text-slate-800">{item.text}</p>
              </div>
              {item.href && (
                <Link href={item.href} className="whitespace-nowrap text-sm font-bold text-blue-700 hover:underline">Open</Link>
              )}
            </div>
          ))
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total accounts"
          value={stats ? String(stats.users.total) : '—'}
          detail={stats ? `${stats.users.active} active · ${stats.users.inactive} inactive` : 'Loading…'}
          tone="blue"
          icon={Users}
        />
        <MetricCard
          label="Needs your decision"
          value={stats ? String(decisionTotal(stats.decisions)) : '—'}
          detail={stats ? decisionDetail(stats.decisions) : 'Loading…'}
          tone={stats && decisionTotal(stats.decisions) > 0 ? 'amber' : 'slate'}
          icon={ClipboardCheck}
          href={stats ? decisionHref(stats.decisions) : undefined}
        />
        <MetricCard
          label="Assets tracked"
          value={stats ? String(stats.assets.total) : '—'}
          detail={stats ? `${stats.assets.available} available · ${stats.assets.lowStock} low stock` : 'Loading…'}
          tone="blue"
          icon={Boxes}
        />
        <MetricCard
          label="Platform"
          value={platformValue}
          detail={health ? `Backend up ${formatUptime(health.uptime)}` : 'Health probe pending'}
          tone={platformTone}
          icon={Server}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Accounts by role" detail="Active and inactive accounts, grouped by assigned role">
          <div className="space-y-3 p-4">
            {stats ? (
              [...ROLE_ORDER, ...Object.keys(RETIRED_ROLE_LABELS).filter((role) => (stats.users.byRole[role] ?? 0) > 0)].map((role) => {
                const count = stats.users.byRole[role] ?? 0;
                return (
                  <div key={role} className="grid grid-cols-[10rem_1fr_2.5rem] items-center gap-3">
                    <span className="truncate text-sm text-slate-700">{ROLE_LABELS[role] ?? RETIRED_ROLE_LABELS[role]}</span>
                    <span className="h-2 rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-blue-600" style={{ width: `${(count / roleMax) * 100}%` }} />
                    </span>
                    <span className="text-right text-sm font-bold tabular-nums text-slate-900">{count}</span>
                  </div>
                );
              })
            ) : (
              <p className="py-6 text-center text-xs text-slate-500">Loading account breakdown…</p>
            )}
          </div>
        </Panel>

        <Panel title="Operational pulse" detail="Cross-system KPIs (shared with Management)">
          <div className="divide-y divide-slate-100 px-4">
            {kpi ? (
              [
                ['Record completeness', `${kpi.recordCompleteness}%`],
                ['Avg. approval time', `${kpi.avgApprovalHours} h`],
                ['SLA compliance', `${kpi.slaComplianceRate}%`],
                ['Fulfilled this month', String(kpi.fulfilledThisMonth)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className="text-sm font-bold text-slate-900">{value}</span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-slate-500">KPI metrics unavailable.</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Platform health"
          detail="Probe result and the runtime configuration in effect"
          action={<Link href="/master-admin/configuration" className="text-xs font-bold text-blue-700 hover:underline">Edit settings</Link>}
        >
          <div className="divide-y divide-slate-100 px-4">
            {([
              { label: 'Backend API', value: health?.reachable ? 'Responding' : 'Unreachable', tone: health?.reachable ? 'green' : 'red' },
              { label: 'Database', value: health?.db ? 'Connected' : 'Unreachable', tone: health?.db ? 'green' : 'red' },
            ] as Array<{ label: string; value: string; tone: AdminTone }>).map((row) => (
              <div key={row.label} className="flex items-center justify-between py-3">
                <span className="text-sm font-semibold text-slate-900">{row.label}</span>
                <StatusChip status={row.value} tone={row.tone} />
              </div>
            ))}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-600">Backend uptime</span>
              <span className="text-sm font-bold text-slate-900">{health ? formatUptime(health.uptime) : '—'}</span>
            </div>
            <div className="space-y-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">Background watchers</span>
                <span className="text-right text-sm font-semibold text-slate-900">{formatSweep(sweep)}</span>
              </div>
              <WatcherRows status={watcherStatus} stats={stats} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">Each row is that watcher&apos;s last run since the backend started.</span>
                <button type="button" onClick={() => void runChecks()} disabled={runningChecks} className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                  {runningChecks ? 'Running…' : 'Run checks now'}
                </button>
              </div>
              {checksError && <p className="text-xs font-semibold text-red-700">{checksError}</p>}
            </div>
            {config && (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 text-xs text-slate-600">
                  <div className="flex justify-between gap-2"><span>Approval SLA</span><span className="font-semibold text-slate-800">{config.slaApprovalHours} h</span></div>
                  <div className="flex justify-between gap-2"><span>Default reorder level</span><span className="font-semibold text-slate-800">{config.defaultReorderLevel}</span></div>
                  <div className="flex justify-between gap-2"><span>Max login attempts</span><span className="font-semibold text-slate-800">{config.maxLoginAttempts}</span></div>
                  <div className="flex justify-between gap-2"><span>Useful life P/S/I</span><span className="font-semibold text-slate-800">{config.usefulLifeYears.PPE}/{config.usefulLifeYears.SEP}/{config.usefulLifeYears.IES} yr</span></div>
                  <div className="flex justify-between gap-2"><span>Repeat-repair limit</span><span className="font-semibold text-slate-800">{config.repeatRepairLimit} / 12 mo</span></div>
                </div>
                <p className="pb-3 text-xs text-slate-500">Runtime config last changed {latestConfigChange(config.meta)}</p>
              </>
            )}
          </div>
        </Panel>

        <Panel
          title="Recent audit activity"
          detail="Latest entries from the append-only audit trail"
          action={<Link href="/master-admin/audit" className="text-xs font-bold text-blue-700 hover:underline">Open audit log</Link>}
        >
          <div className="divide-y divide-slate-100 px-4">
            {recentLogs.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">{loading ? 'Loading…' : 'No recent audit activity.'}</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{auditEventLabel(log)}</p>
                    <StatusChip status={roleLabel(log.userRole)} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{[auditActor(log), log.ipAddress || 'no-ip', formatDateTime(log.timestamp)].filter(Boolean).join(' · ')}</p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>{stats.audit.eventsToday} audit events today</span>
          <span>{stats.audit.failedLoginsToday} failed logins today</span>
          <span>{stats.assets.available} of {stats.assets.total} assets available</span>
        </div>
      )}
    </div>
  );
}
