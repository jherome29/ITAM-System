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
    <div className="@container flex min-w-0 flex-col gap-4 sm:gap-5">
      <div className="relative isolate overflow-hidden rounded-lg bg-linear-to-r from-navy via-brand to-blue-900 px-5 py-6 shadow-sm sm:px-7 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-24 -z-10 size-96 rounded-full border border-white/15 bg-white/5 ring-[48px] ring-white/5" />
        <PageHeader inverse eyebrow="My Dashboard" title={`Good day, ${user?.firstName ?? 'there'}`} />
        <nav aria-label="Quick actions" className="mt-5 flex flex-wrap gap-2.5">
          <Link href="/employee/requisitions/new" className={buttonClass()}>
            <Plus className="size-4" aria-hidden="true" /> New requisition
          </Link>
          <Link href="/employee/catalogue" className={buttonClass({ variant: 'secondary' })}>
            <Search className="size-4" aria-hidden="true" /> Browse catalogue
          </Link>
          <Link href="/employee/returns-incidents" className={buttonClass({ variant: 'secondary' })}>
            <Undo2 className="size-4" aria-hidden="true" /> File return or incident
          </Link>
        </nav>
      </div>

      {error && (
        <Notice tone="red">{error}</Notice>
      )}

      <section aria-label="Dashboard totals" className="grid gap-4 min-[360px]:grid-cols-2 sm:gap-5 @[50rem]:grid-cols-4">
        <MetricCard href="/employee/assigned-assets" label="Assigned assets" value={error ? '—' : assets.length} icon={PackageCheck} tone="blue" />
        <MetricCard href="/employee/requisitions" label="Active requests" value={error ? '—' : activeRequestCount} icon={ClipboardList} tone="blue" />
        <MetricCard href="/employee/assigned-assets" label="Returns due" value={error ? '—' : returnsDue.length} icon={Undo2} tone="amber" />
        <MetricCard href="/employee/notifications" label="Unread updates" value={error ? '—' : unreadCount} icon={Bell} tone="green" />
      </section>

      {!error && (
        <div className="grid min-w-0 items-start gap-4 sm:gap-5 @[55rem]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] @[55rem]:grid-rows-[auto_1fr]">
          <Panel
            title="Needs your attention"
            badge={attentionCount > 0 ? <Chip tone="amber">{attentionCount} {attentionCount === 1 ? 'item' : 'items'}</Chip> : undefined}
            className="@[55rem]:col-start-2 @[55rem]:row-start-1"
          >
            {attentionCount === 0 ? (
              <EmptyMessage>You’re all caught up.</EmptyMessage>
            ) : (
              <ul className="divide-y divide-slate-100">
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
              </ul>
            )}
          </Panel>

          <Panel title="Active requests" detail="Track requests through approval and fulfillment"
            className="@[55rem]:col-start-1 @[55rem]:row-span-2 @[55rem]:row-start-1"
            action={<Link href="/employee/requisitions" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">View all <ArrowRight className="size-4" aria-hidden="true" /></Link>}
          >
            {activeRequests.length === 0 ? (
                  <EmptyMessage>{activeRequestCount > 0
                    ? 'Open My Requisitions to see your requests in progress.'
                    : 'You have no requisitions in progress.'}</EmptyMessage>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeRequests.slice(0, 6).map((request) => {
                  const primaryItem = request.items[0]?.itemDescription ?? 'Requisition';
                  const extraItems = request.items.length > 1 ? ` +${request.items.length - 1} more` : '';
                  return (
                    <Link key={request.id} href={`/employee/requisitions/${request.id}`} className="group flex min-h-20 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-slate-50">
                      <span className="grid size-9 flex-none place-items-center rounded-lg bg-blue-50 text-blue-700">
                        <ClipboardList className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1 basis-32">
                        <p className="text-sm font-semibold text-slate-950 group-hover:text-blue-700">{primaryItem}{extraItems}</p>
                        <p className="mt-1 text-xs text-slate-500">{request.requestNumber} · Needed {formatDate(request.requiredDate)}</p>
                      </div>
                      <div className="flex items-center gap-2 pl-[52px] sm:pl-0">
                        <StatusBadge status={request.status} label={requisitionStatusLabel(request.status)} />
                        <ChevronRight aria-hidden="true" className="size-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            {activeRequestCount > Math.min(activeRequests.length, 6) && activeRequests.length > 0 && (
              <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">Showing {Math.min(activeRequests.length, 6)} of {activeRequestCount} active requests</p>
            )}
          </Panel>

          <Panel title="My assigned assets" className="@[55rem]:col-start-2 @[55rem]:row-start-2"
            action={<Link href="/employee/assigned-assets" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">View assets <ArrowRight className="size-4" aria-hidden="true" /></Link>}
          >
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
      )}
    </div>
  );
}


function AttentionRow({ icon: Icon, title, detail, meta, href, action, tone }: Readonly<{ icon: LucideIcon; title: string; detail: string; meta: string; href: string; action: string; tone: 'amber' | 'red' }>) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-4 py-3.5">
      <span className={`grid size-9 place-items-center rounded-lg ring-1 ${toneStyles[tone]}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        {meta && <p className="mt-0.5 text-xs text-slate-500">{meta}</p>}
        <p className="mt-1 text-sm leading-5 text-slate-600">{detail}</p>
        <Link href={href} className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
          {action} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}
