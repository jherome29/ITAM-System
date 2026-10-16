'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileWarning,
  Laptop,
  MapPin,
  PackageCheck,
  Plus,
  Repeat2,
  Search,
  Send,
  Undo2,
} from 'lucide-react';
import { DashboardSkeleton } from '@/components/states/DashboardSkeleton';
import { useAuth } from '@/lib/auth/use-auth';
import { requisitionsApi, type Requisition, type RequisitionStats } from '@/lib/api/requisitions';
import { notificationsApi } from '@/lib/api/notifications';
import { assetsApi, type MyAsset } from '@/lib/api/assets';
import { localToday } from '@/lib/dates';
import { formatDate, requisitionStatusLabel } from '@/lib/requisitions/requisition-view';
import { PageHeader } from '@/components/ui/PageHeader';
import { buttonClass } from '@/components/ui/buttons';
import { Chip } from '@/components/ui/Chip';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MetricCard } from '@/components/ui/MetricCard';
import { Panel } from '@/components/ui/Panel';
import { toneStyles } from '@/components/ui/tones';
import { Notice } from '@/components/ui/Notice';
import { EmptyMessage } from '@/components/ui/EmptyRow';
import { humanize } from '@/lib/text';

/** A loaned item due back within this many days shows under "Needs your attention". */
const DUE_SOON_DAYS = 7;

function addDays(isoDay: string, days: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Issued items with a return date that is past or within DUE_SOON_DAYS. */
function dueBack(assets: MyAsset[], today: string): MyAsset[] {
  const horizon = addDays(today, DUE_SOON_DAYS);
  return assets
    .filter((a) => a.status === 'issued' && a.expectedReturnDate && a.expectedReturnDate.slice(0, 10) <= horizon)
    .sort((a, b) => String(a.expectedReturnDate).localeCompare(String(b.expectedReturnDate)));
}

// Statuses that mean a request is still moving — mirrors RequisitionStatus in
// packages/shared/src/enums minus the terminal FULFILLED/REJECTED/CANCELLED states.
const ACTIVE_STATUSES = new Set(['pending_supervisor', 'pending_fulfillment', 'on_hold']);

export function EmployeeDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Requisition[]>([]);
  const [stats, setStats] = useState<RequisitionStats | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [assets, setAssets] = useState<MyAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([requisitionsApi.mine(), requisitionsApi.stats(), notificationsApi.list(), assetsApi.mine()])
      .then(([requisitionsRes, statsRes, notificationsRes, assetsRes]) => {
        if (cancelled) return;
        setRequests(requisitionsRes.data.data);
        setStats(statsRes.data);
        setUnreadCount(notificationsRes.data.unreadCount);
        setAssets(assetsRes.data);
        setError('');
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your dashboard data. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = localToday();
  const returnsDue = dueBack(assets, today);
  // Qualifies for a replacement and none is open yet — the holder may want one.
  const replaceable = assets.filter((a) => a.replacement?.eligible && !a.replacement.openRequestNumber);
  const activeRequests = requests.filter((request) => ACTIVE_STATUSES.has(request.status));
  const rejectedRequests = requests.filter((request) => request.status === 'rejected');
  const activeRequestCount = stats ? stats.pending + stats.onHold : activeRequests.length;
  const attentionCount = returnsDue.length + replaceable.length + rejectedRequests.length;

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Employee workspace"
        title={`Good day, ${user?.firstName ?? 'there'}`}
        detail="Review what needs action and keep track of your requests and accountable property."
        divider
        action={
          <Link href="/employee/requisitions/new" className={buttonClass()}>
            <Plus className="h-5 w-5" aria-hidden="true" />
            New requisition
          </Link>
        }
      />

      {error && (
        <Notice tone="red">{error}</Notice>
      )}

      <section aria-labelledby="employee-overview-heading" className="space-y-2">
        <h2 id="employee-overview-heading" className="text-lg font-bold text-slate-950">Overview</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard href="/employee/assigned-assets" label="Assigned assets" value={assets.length} detail="Accountable to you" icon={PackageCheck} tone="blue" />
          <MetricCard href="/employee/requisitions" label="Active requests" value={activeRequestCount} detail="In progress" icon={ClipboardList} tone="blue" />
          <MetricCard href="/employee/assigned-assets" label="Due back" value={returnsDue.length} detail={`Overdue or within ${DUE_SOON_DAYS} days`} icon={Undo2} tone="amber" />
          <MetricCard href="/employee/notifications" label="Unread updates" value={unreadCount} detail="New activity" icon={Bell} tone="green" />
        </div>
      </section>

      <section aria-labelledby="employee-attention-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="employee-attention-heading" className="text-lg font-bold text-slate-950">Needs your attention</h2>
            <p className="mt-0.5 text-xs text-slate-500">Prioritized tasks that require your response</p>
          </div>
          <Chip tone="amber">{attentionCount} pending</Chip>
        </div>
        {attentionCount === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">You are all caught up — nothing needs your attention right now.</div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {returnsDue.map((asset) => {
              const due = String(asset.expectedReturnDate).slice(0, 10);
              const overdue = due < today;
              return (
                <AttentionRow
                  key={`return-${asset.id}`}
                  icon={Undo2}
                  title={`${overdue ? 'Overdue: return' : 'Return'} ${asset.itemDescription}`}
                  detail={overdue ? `It was due back on ${formatDate(due)}. Return it to the custodian or file a return request.` : `Due back on ${formatDate(due)}.`}
                  meta={asset.propertyNumber || asset.serialNumber || ''}
                  href="/employee/returns-incidents"
                  action="File a return"
                  tone={overdue ? 'red' : 'amber'}
                />
              );
            })}
            {replaceable.map((asset) => (
              <AttentionRow
                key={`replace-${asset.id}`}
                icon={Repeat2}
                title={`${asset.itemDescription} qualifies for a replacement`}
                detail={asset.replacement.reason}
                meta={asset.propertyNumber || asset.serialNumber || ''}
                href="/employee/assigned-assets"
                action="Request replacement"
                tone="amber"
              />
            ))}
            {rejectedRequests.map((request) => (
              <AttentionRow
                key={request.id}
                icon={FileWarning}
                title={`${request.items[0]?.itemDescription ?? 'Requisition'} was rejected`}
                detail={request.supervisorComments ?? 'Reviewed by your supervisor. See request details for more information.'}
                meta={request.requestNumber}
                href={`/employee/requisitions/${request.id}`}
                action="View details"
                tone="red"
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)]">
        <Panel title="Active requests" detail="Requests still moving through review or fulfillment" action={<Link href="/employee/requisitions" className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-900">View all<ArrowRight className="h-4 w-4" /></Link>}>
          {activeRequests.length === 0 ? (
            <EmptyMessage>You have no requisitions in progress.</EmptyMessage>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeRequests.slice(0, 6).map((request) => {
                const primaryItem = request.items[0]?.itemDescription ?? 'Requisition';
                const extraItems = request.items.length > 1 ? ` +${request.items.length - 1} more` : '';
                return (
                  <Link key={request.id} href={`/employee/requisitions/${request.id}`} className="group grid gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto_auto_20px] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-950 group-hover:text-blue-700">{primaryItem}{extraItems}</p>
                      <p className="mt-1 text-xs text-slate-500">{request.requestNumber} · Needed {String(request.requiredDate).slice(0, 10)}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" />{formatDate(request.updatedAt)}</span>
                    <StatusBadge status={request.status} label={requisitionStatusLabel(request.status)} />
                    <ChevronRight className="hidden h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-blue-600 sm:block" />
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="My property" detail="Assets under your accountability" action={<Link href="/employee/assigned-assets" className="text-sm font-bold text-blue-700 hover:text-blue-900">Manage</Link>}>
          {assets.length === 0 ? (
            <EmptyMessage>No property is assigned to you.</EmptyMessage>
          ) : (
            <div className="divide-y divide-slate-100">
              {assets.slice(0, 6).map((asset) => {
                const location = asset.officeLocation || asset.officeOrSection;
                return (
                  <Link href="/employee/assigned-assets" key={asset.id} className="group flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-md bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700"><Laptop className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-bold text-slate-950">{asset.itemDescription}</p><StatusBadge status={asset.status} /></div>
                      <p className="mt-1 text-xs text-slate-500">{[asset.propertyNumber || asset.serialNumber, humanize(asset.condition)].filter(Boolean).join(' · ')}</p>
                      {asset.repair ? (
                        <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" />Under repair — expected back {formatDate(asset.repair.dueDate)}</p>
                      ) : location ? (
                        <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{location}</p>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
              {assets.length > 6 && <Link href="/employee/assigned-assets" className="block px-4 py-3 text-center text-xs font-bold text-blue-700 hover:bg-slate-50">View all {assets.length}</Link>}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Quick actions">
        <div className="grid sm:grid-cols-3">
          <QuickAction href="/employee/catalogue" icon={Search} title="Browse catalogue" detail="Find requestable assets and supplies" />
          <QuickAction href="/employee/requisitions/new" icon={Send} title="Submit request" detail="Create a new or replacement requisition" />
          <QuickAction href="/employee/returns-incidents" icon={FileWarning} title="File return or incident" detail="Report return, repair, damage, loss, or theft" />
        </div>
      </Panel>
    </div>
  );
}


function AttentionRow({ icon: Icon, title, detail, meta, href, action, tone }: Readonly<{ icon: LucideIcon; title: string; detail: string; meta: string; href: string; action: string; tone: 'amber' | 'red' }>) {
  return <article className="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[auto_minmax(0,1fr)]"><span className={`grid h-10 w-10 place-items-center rounded-md ring-1 ${toneStyles[tone]}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-slate-950">{title}</p><span className="text-xs font-semibold text-slate-500">{meta}</span></div><p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p><Link href={href} className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-900">{action}<ArrowRight className="h-4 w-4" /></Link></div></article>;
}

function QuickAction({ href, icon: Icon, title, detail }: Readonly<{ href: string; icon: LucideIcon; title: string; detail: string }>) {
  return <Link href={href} className="group flex min-h-[82px] items-center gap-3 border-b border-slate-100 p-4 transition last:border-b-0 hover:bg-slate-50 sm:border-r sm:border-b-0 sm:last:border-r-0"><span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon className="h-[18px] w-[18px]" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-950 group-hover:text-blue-700">{title}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{detail}</span></span><ChevronRight className="h-4 w-4 flex-none text-slate-500 group-hover:text-blue-600" /></Link>;
}
