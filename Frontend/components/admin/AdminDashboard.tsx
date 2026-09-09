'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, Boxes, CheckCircle2, ClipboardCheck, Server, Users } from 'lucide-react';
import { adminApi, type AdminDashboardStats } from '@/lib/api/admin';
import { healthApi, type HealthStatus } from '@/lib/api/health';
import { systemConfigApi, type SystemConfig } from '@/lib/api/systemConfig';
import { reportsApi, type KpiData } from '@/lib/api/reports';
import { auditApi, type AuditLog } from '@/lib/api/audit';
import { AdminPageHeader, MetricCard, Panel, StatusChip, type AdminTone } from './AdminUi';

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
  property_officer: 'Property Officer',
};
const ROLE_ORDER = Object.keys(ROLE_LABELS);

const plural = (n: number) => (n === 1 ? '' : 's');

function formatUptime(seconds: number): string {
  if (seconds <= 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface AttentionItem {
  tone: AdminTone;
  text: string;
  href?: string;
}

function buildAttention(stats: AdminDashboardStats, health: HealthStatus | null): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (health && !health.db) {
    items.push({ tone: 'red', text: 'Database unreachable — GET /api/health is reporting the connection down.' });
  }
  if (stats.users.locked > 0) {
    items.push({ tone: 'amber', text: `${stats.users.locked} account${plural(stats.users.locked)} locked out of sign-in.`, href: '/master-admin/users' });
  }
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
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      adminApi.dashboardStats(),
      healthApi.check(),
      systemConfigApi.get(),
      reportsApi.kpi(),
      auditApi.list(1, 6),
    ]).then(([s, h, c, k, a]) => {
      if (cancelled) return;
      if (s.status === 'fulfilled') setStats(s.value.data);
      else setFailed(true);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (c.status === 'fulfilled') setConfig(c.value.data);
      if (k.status === 'fulfilled') setKpi(k.value.data);
      if (a.status === 'fulfilled') setRecentLogs(a.value.data.data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const platformValue = health ? (health.db ? 'Operational' : 'Degraded') : 'Unknown';
  const platformTone: AdminTone = health ? (health.db ? 'green' : 'red') : 'slate';
  const attention = stats ? buildAttention(stats, health) : [];
  const roleMax = stats ? Math.max(1, ...Object.values(stats.users.byRole)) : 1;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <AdminPageHeader
        title="Administration Overview"
        detail="Live account, requisition, asset, and platform figures — every number below is read straight from the system of record."
        action={stats ? <span className="text-xs text-slate-500">Updated {new Date(stats.generatedAt).toLocaleTimeString()}</span> : undefined}
      />

      {failed && (
        <section className="rounded-lg border border-red-200 border-l-4 border-l-red-500 bg-white px-4 py-3 text-sm text-red-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          Could not load dashboard statistics. The admin API may be unreachable — try refreshing.
        </section>
      )}

      <section aria-label="Items needing attention" className="space-y-2">
        {loading ? (
          <div className="h-16 animate-pulse rounded-lg border border-slate-200 bg-white" />
        ) : attention.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 border-l-4 border-l-emerald-500 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CheckCircle2 className="h-5 w-5 flex-none text-emerald-600" />
            <p className="text-sm font-semibold text-slate-900">No administrative items need attention right now.</p>
          </div>
        ) : (
          attention.map((item) => (
            <div key={item.text} className={`flex flex-col gap-2 rounded-lg border border-slate-200 border-l-4 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between ${attentionRowClass[item.tone]}`}>
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
          label="Pending approvals"
          value={stats ? String(stats.requisitions.pendingSupervisor) : '—'}
          detail={stats ? (stats.requisitions.slaBreached > 0 ? `${stats.requisitions.slaBreached} past SLA` : 'All within SLA') : 'Loading…'}
          tone={stats && stats.requisitions.slaBreached > 0 ? 'amber' : 'slate'}
          icon={ClipboardCheck}
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
              ROLE_ORDER.map((role) => {
                const count = stats.users.byRole[role] ?? 0;
                return (
                  <div key={role} className="grid grid-cols-[10rem_1fr_2.5rem] items-center gap-3">
                    <span className="truncate text-sm text-slate-700">{ROLE_LABELS[role]}</span>
                    <span className="h-2 rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-blue-600" style={{ width: `${(count / roleMax) * 100}%` }} />
                    </span>
                    <span className="text-right text-sm font-bold tabular-nums text-slate-900">{count}</span>
                  </div>
                );
              })
            ) : (
              <p className="py-6 text-center text-xs text-slate-400">Loading account breakdown…</p>
            )}
          </div>
        </Panel>

        <Panel title="Operational pulse" detail="Cross-system KPIs (shared with Management)">
          <div className="divide-y divide-slate-100 px-4">
            {kpi ? (
              [
                ['Inventory accuracy', `${kpi.inventoryAccuracy}%`],
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
              <p className="py-6 text-center text-xs text-slate-400">KPI metrics unavailable.</p>
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
              { label: 'Admin console', value: 'Loaded', tone: 'green' },
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
            {config && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 text-xs text-slate-600">
                <div className="flex justify-between gap-2"><span>Approval SLA</span><span className="font-semibold text-slate-800">{config.slaApprovalHours} h</span></div>
                <div className="flex justify-between gap-2"><span>Default reorder level</span><span className="font-semibold text-slate-800">{config.defaultReorderLevel}</span></div>
                <div className="flex justify-between gap-2"><span>Max login attempts</span><span className="font-semibold text-slate-800">{config.maxLoginAttempts}</span></div>
                <div className="flex justify-between gap-2"><span>Useful life P/S/I</span><span className="font-semibold text-slate-800">{config.usefulLifeYears.PPE}/{config.usefulLifeYears.SEP}/{config.usefulLifeYears.IES} yr</span></div>
              </div>
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
              <p className="py-6 text-center text-xs text-slate-400">{loading ? 'Loading…' : 'No recent audit activity.'}</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{log.action.replace(/_/g, ' ')}</p>
                    <StatusChip status={log.userRole.replace(/_/g, ' ')} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{log.ipAddress || 'no-ip'} · {new Date(log.timestamp).toLocaleString()}</p>
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
