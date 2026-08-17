'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Server, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { adminActivityTrend, accessReviews, auditRecords, scheduledJobs, systemEvents } from '@/lib/mock/admin.mock';
import { AdminPageHeader, MetricCard, Panel, StatusChip } from './AdminUi';

function systemHealthTone(status: string) {
  if (status === 'Available') return 'text-emerald-600';
  if (status === 'Unavailable') return 'text-red-600';
  return 'text-amber-600';
}

export function AdminDashboard() {
  const maxActivity = Math.max(...adminActivityTrend.flatMap((item) => [item.accounts, item.roles, item.security]));

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <AdminPageHeader title="Administration Overview" detail="Monitor account governance, security posture, platform health, and administrative work requiring attention." />

      <section className="flex flex-col gap-3 rounded-lg border border-amber-200 border-l-4 border-l-amber-500 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between" aria-label="Administrative alerts">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-amber-700" />
          <div><p className="text-sm font-bold text-slate-950">Three administrative items need review</p><p className="mt-0.5 text-xs text-slate-600">Database connectivity is unavailable, one access review is at risk, and one privileged account is locked.</p></div>
        </div>
        <Link href="/master-admin/access-reviews" className="whitespace-nowrap text-sm font-bold text-amber-900 hover:underline">Review items</Link>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active accounts" value="125" detail="Across 9 offices" tone="blue" icon={Users} />
        <MetricCard label="MFA coverage" value="94%" detail="7 enrollments remaining" tone="green" icon={ShieldCheck} />
        <MetricCard label="Reviews due" value="2" detail="One currently at risk" tone="amber" icon={UserCheck} />
        <MetricCard label="Platform status" value="Degraded" detail="Database connection unavailable" tone="red" icon={Server} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Administrative Activity" detail="Account, role, and security events over the last seven days">
          <div className="p-4">
            <div className="flex h-52 items-end gap-3 border-b border-l border-slate-200 px-3 pb-2">
              {adminActivityTrend.map((item) => (
                <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
                  <div className="flex items-end justify-center gap-1">
                    <span title={`${item.accounts} account events`} className="w-2.5 bg-blue-600" style={{ height: `${(item.accounts / maxActivity) * 150}px` }} />
                    <span title={`${item.roles} role events`} className="w-2.5 bg-amber-500" style={{ height: `${(item.roles / maxActivity) * 150}px` }} />
                    <span title={`${item.security} security events`} className="w-2.5 bg-red-500" style={{ height: `${(item.security / maxActivity) * 150}px` }} />
                  </div>
                  <span className="text-center text-[11px] text-slate-500">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-slate-600"><span><i className="mr-1.5 inline-block h-2 w-2 bg-blue-600" />Accounts</span><span><i className="mr-1.5 inline-block h-2 w-2 bg-amber-500" />Roles</span><span><i className="mr-1.5 inline-block h-2 w-2 bg-red-500" />Security</span></div>
          </div>
        </Panel>
        <Panel title="Security Posture" detail="Administrative account safeguards">
          <div className="divide-y divide-slate-100 px-4">
            {[['MFA on privileged accounts', '22 of 24', 'Review'], ['Dormant account control', '6 of 8 resolved', 'At risk'], ['Quarterly access certification', '71% complete', 'In progress'], ['Append-only audit capture', 'Operational', 'Healthy']].map(([label, value, status]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-semibold text-slate-900">{label}</p><p className="mt-0.5 text-xs text-slate-500">{value}</p></div><StatusChip status={status} /></div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Access Reviews" detail="Certification work requiring owner action" action={<Link href="/master-admin/access-reviews" className="text-xs font-bold text-blue-700">View all</Link>}>
          <div className="divide-y divide-slate-100 px-4">{accessReviews.slice(0, 3).map((item) => <div key={item.id} className="py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.owner} - due {item.due}</p></div><StatusChip status={item.status} /></div><div className="mt-2 h-1.5 bg-slate-100"><div className="h-full bg-blue-600" style={{ width: `${item.progress}%` }} /></div></div>)}</div>
        </Panel>
        <Panel title="System Health" detail="Current platform services" action={<Link href="/master-admin/technical-logs" className="text-xs font-bold text-blue-700">Diagnostics</Link>}>
          <div className="divide-y divide-slate-100 px-4">
            {[['Frontend', 'Available', CheckCircle2], ['Backend API', 'Starting', Clock3], ['Database', 'Unavailable', AlertTriangle], ['Scheduled jobs', 'Running with warnings', Activity]].map(([name, status, Icon]) => { const ItemIcon = Icon as typeof Activity; return <div key={String(name)} className="flex items-center gap-3 py-3"><ItemIcon className={`h-4 w-4 ${systemHealthTone(status as string)}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{name as string}</p><p className="text-xs text-slate-500">{status as string}</p></div></div>; })}
          </div>
        </Panel>
        <Panel title="Recent Audit Activity" detail="Latest immutable administrative evidence" action={<Link href="/master-admin/audit" className="text-xs font-bold text-blue-700">Open audit log</Link>}>
          <div className="divide-y divide-slate-100 px-4">{auditRecords.slice(0, 4).map((item) => <div key={item.id} className="py-3"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{item.action.replaceAll('_', ' ')}</p><StatusChip status={item.outcome} /></div><p className="mt-1 text-xs text-slate-500">{item.actor} - {item.record} - {item.timestamp}</p></div>)}</div>
        </Panel>
      </div>

      <Panel title="Scheduled Jobs" detail="Automation affecting SLA alerts, retention, and lifecycle notifications">
        <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">{scheduledJobs.map((job) => <div key={job.id} className="p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-slate-900">{job.name}</p><StatusChip status={job.result} /></div><dl className="mt-3 space-y-1 text-xs text-slate-500"><div className="flex justify-between gap-3"><dt>Last run</dt><dd>{job.lastRun}</dd></div><div className="flex justify-between gap-3"><dt>Next run</dt><dd>{job.nextRun}</dd></div><div className="flex justify-between gap-3"><dt>Duration</dt><dd>{job.duration}</dd></div></dl></div>)}</div>
      </Panel>

      <p className="sr-only">{systemEvents.length} technical events are available in System Health and Jobs.</p>
    </div>
  );
}
