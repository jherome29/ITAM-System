'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileWarning,
  Laptop,
  MapPin,
  PackageCheck,
  Plus,
  Search,
  Send,
} from 'lucide-react';
import { StatusChip } from '@/components/admin/AdminUi';
import { assetMockRows } from '@/lib/mock/assets.mock';
import { notificationMockRows } from '@/lib/mock/notifications.mock';
import { requisitionMockRows } from '@/lib/mock/requisitions.mock';

const employeeId = 'EMP-001';

export function EmployeeDashboard() {
  const requests = requisitionMockRows.filter((request) => request.requesterId === employeeId);
  const assets = assetMockRows.filter((asset) => asset.assignedEmployeeId === employeeId);
  const unread = notificationMockRows.filter((item) => item.unread).length;
  const activeRequests = requests.filter((item) => !['Fulfilled', 'Cancelled', 'Rejected'].includes(item.status));
  const pendingAssets = assets.filter((item) => item.acknowledgmentStatus === 'Pending');
  const revisionRequests = requests.filter((item) => item.status === 'Returned for Revision');
  const attentionCount = pendingAssets.length + revisionRequests.length;

  return (
    <div className="employee-dashboard mx-auto w-full max-w-[1480px] space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Employee workspace</p>
          <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-slate-950 md:text-[32px]">Good day, Ana</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
            Review what needs action and keep track of your requests and accountable property.
          </p>
        </div>
        <Link href="/employee/requisitions/new" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New requisition
        </Link>
      </header>

      <section aria-labelledby="employee-overview-heading" className="space-y-2">
        <h2 id="employee-overview-heading" className="text-lg font-extrabold text-slate-950">Overview</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric href="/employee/assigned-assets" label="Assigned assets" value={assets.length} detail="Accountable to you" icon={PackageCheck} tone="blue" />
          <SummaryMetric href="/employee/requisitions" label="Active requests" value={activeRequests.length} detail="In progress" icon={ClipboardList} tone="blue" />
          <SummaryMetric href="/employee/assigned-assets" label="To acknowledge" value={pendingAssets.length} detail="Action required" icon={CheckCircle2} tone="amber" />
          <SummaryMetric href="/employee/notifications" label="Unread updates" value={unread} detail="New activity" icon={Bell} tone="green" />
        </div>
      </section>

      <section aria-labelledby="employee-attention-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="employee-attention-heading" className="text-lg font-extrabold text-slate-950">Needs your attention</h2>
            <p className="mt-0.5 text-xs text-slate-500">Prioritized tasks that require your response</p>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">{attentionCount} pending</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {pendingAssets.map((asset) => (
            <AttentionRow
              key={asset.id}
              icon={CheckCircle2}
              title={`Acknowledge ${asset.name}`}
              detail="Confirm receipt and the recorded condition of this asset."
              meta={asset.id}
              href="/employee/assigned-assets"
              action="Acknowledge"
              tone="amber"
            />
          ))}
          {revisionRequests.map((request) => (
            <AttentionRow
              key={request.id}
              icon={FileWarning}
              title={`${request.item} needs revision`}
              detail={request.remarks ?? 'Review the approving officer remarks and resubmit.'}
              meta={request.id}
              href={`/employee/requisitions/${request.id}`}
              action="Revise request"
              tone="red"
            />
          ))}
        </div>
      </section>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)]">
        <DashboardPanel title="Active requests" detail="Requests still moving through review or fulfillment" action={<Link href="/employee/requisitions" className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-900">View all<ArrowRight className="h-4 w-4" /></Link>}>
          <div className="divide-y divide-slate-100">
            {activeRequests.map((request) => (
              <Link key={request.id} href={`/employee/requisitions/${request.id}`} className="group grid gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto_auto_20px] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950 group-hover:text-blue-700">{request.item}</p>
                  <p className="mt-1 text-xs text-slate-500">{request.id} · Needed {request.requiredDate}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" />{request.lastUpdate}</span>
                <StatusChip status={request.status} tone={request.status === 'Returned for Revision' ? 'amber' : 'blue'} />
                <ChevronRight className="hidden h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600 sm:block" />
              </Link>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel title="My property" detail="Assets under your accountability" action={<Link href="/employee/assigned-assets" className="text-sm font-bold text-blue-700 hover:text-blue-900">Manage</Link>}>
          <div className="divide-y divide-slate-100">
            {assets.map((asset) => (
              <Link href="/employee/assigned-assets" key={asset.id} className="group flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-md bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700"><Laptop className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-bold text-slate-950">{asset.name}</p><StatusChip status={asset.acknowledgmentStatus} tone={asset.acknowledgmentStatus === 'Pending' ? 'amber' : 'green'} /></div>
                  <p className="mt-1 text-xs text-slate-500">{asset.id} · {asset.condition}</p>
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{asset.location}</p>
                </div>
              </Link>
            ))}
          </div>
        </DashboardPanel>
      </div>

      <DashboardPanel title="Quick actions">
        <div className="grid sm:grid-cols-3">
          <QuickAction href="/employee/catalogue" icon={Search} title="Browse catalogue" detail="Find requestable assets and supplies" />
          <QuickAction href="/employee/requisitions/new" icon={Send} title="Submit request" detail="Create a new or replacement requisition" />
          <QuickAction href="/employee/returns-incidents" icon={FileWarning} title="File return or incident" detail="Report return, repair, damage, loss, or theft" />
        </div>
      </DashboardPanel>
    </div>
  );
}

const tones = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  red: 'border-red-200 bg-red-50 text-red-700',
};

function AttentionRow({ icon: Icon, title, detail, meta, href, action, tone }: { icon: LucideIcon; title: string; detail: string; meta: string; href: string; action: string; tone: 'amber' | 'red' }) {
  return <article className="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)] sm:grid-cols-[auto_minmax(0,1fr)]"><span className={`grid h-10 w-10 place-items-center rounded-md border ${tones[tone]}`}><Icon className="h-4 w-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-slate-950">{title}</p><span className="text-xs font-semibold text-slate-500">{meta}</span></div><p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p><Link href={href} className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-900">{action}<ArrowRight className="h-4 w-4" /></Link></div></article>;
}

function SummaryMetric({ href, label, value, detail, icon: Icon, tone }: { href: string; label: string; value: number; detail: string; icon: LucideIcon; tone: 'blue' | 'amber' | 'green' }) {
  return (
    <Link href={href} className="group flex min-h-[104px] min-w-0 items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-[0_3px_12px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
      <span className={`grid h-12 w-12 flex-none place-items-center rounded-lg border ${tones[tone]}`}>
        <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-slate-500">{label}</span>
        <span className="mt-1.5 flex min-w-0 items-baseline gap-2">
          <span className="text-[26px] font-extrabold leading-none text-slate-950">{value}</span>
          <span className={`truncate text-xs font-bold ${tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : 'text-blue-700'}`}>{detail}</span>
        </span>
      </span>
    </Link>
  );
}

function DashboardPanel({ title, detail, action, children }: { title: string; detail?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.05)]"><div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-4 py-4"><div><h2 className="text-[15px] font-extrabold text-slate-950">{title}</h2>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</div>{action}</div>{children}</section>;
}

function QuickAction({ href, icon: Icon, title, detail }: { href: string; icon: LucideIcon; title: string; detail: string }) {
  return <Link href={href} className="group flex min-h-[82px] items-center gap-3 border-b border-slate-100 p-4 transition last:border-b-0 hover:bg-slate-50 sm:border-r sm:border-b-0 sm:last:border-r-0"><span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon className="h-[18px] w-[18px]" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-950 group-hover:text-blue-700">{title}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{detail}</span></span><ChevronRight className="h-4 w-4 flex-none text-slate-300 group-hover:text-blue-600" /></Link>;
}
