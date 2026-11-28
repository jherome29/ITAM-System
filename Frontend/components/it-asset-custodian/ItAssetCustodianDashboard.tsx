'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate } from '@/lib/dates';
import {
  Archive, ArrowRight, Bell, Boxes, Building2, CheckCircle2, ClipboardList, Laptop, Package, ScanLine, Wrench,
} from 'lucide-react';
import { assetsApi } from '@/lib/api/assets';
import { requisitionsApi } from '@/lib/api/requisitions';
import { notificationsApi } from '@/lib/api/notifications';
import { useAuth } from '@/lib/auth/use-auth';
import { DashboardError, useRoleDashboardData } from '@/components/dashboard/RoleDashboardShell';

const basePath = '/asset-custodian';
const queuePath = `${basePath}/fulfillment`;
const queuePreviewSize = 5;
const numberFormat = new Intl.NumberFormat('en-PH');

const inventoryCategories = [
  { type: 'ICT', label: 'IT Inventory', path: 'it-inventory', icon: Laptop, color: 'bg-blue-600' },
  { type: 'Fixed', label: 'Fixed Asset Inventory', path: 'fixed-assets', icon: Building2, color: 'bg-indigo-500' },
  { type: 'Supplies', label: 'Supplies Inventory', path: 'supplies', icon: Package, color: 'bg-teal-600' },
] as const;

export function ItAssetCustodianDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useRoleDashboardData(async () => {
    const [statsRes, reqRes, notifRes] = await Promise.all([
      assetsApi.stats(),
      requisitionsApi.list(1, queuePreviewSize, 'pending_fulfillment'),
      notificationsApi.list(),
    ]);
    return {
      stats: statsRes.data,
      pendingFulfillment: reqRes.data.data,
      pendingTotal: reqRes.data.total,
      unreadCount: notifRes.data.unreadCount,
    };
  });

  const inventoryByType = data?.stats.inventoryByType;
  const inventoryTotal = inventoryByType && Object.values(inventoryByType).reduce((sum, count) => sum + count, 0);
  const metrics = [
    { label: 'Inventory records', value: inventoryTotal, icon: Boxes, tone: 'bg-blue-50 text-blue-700', href: `${basePath}/assets` },
    { label: 'Available', value: data?.stats.available, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700', href: `${basePath}/assets` },
    { label: 'Awaiting fulfillment', value: data?.pendingTotal, icon: ClipboardList, tone: 'bg-amber-50 text-amber-700', href: queuePath },
    { label: 'Under repair', value: data?.stats.underRepair, icon: Wrench, tone: 'bg-rose-50 text-rose-700', href: `${basePath}/maintenance` },
    { label: 'Disposed assets', value: data?.stats.disposed, icon: Archive, tone: 'bg-slate-100 text-slate-700', href: `${basePath}/disposed-assets` },
  ];

  return (
    <div className="@container mx-auto flex w-full max-w-[1480px] flex-col gap-4 pb-5 sm:gap-5">
      <div className="relative isolate overflow-hidden rounded-lg bg-linear-to-r from-navy via-brand to-blue-900 px-5 py-6 text-white shadow-sm sm:px-7 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -top-48 -right-28 -z-10 size-[30rem] rounded-full border border-white/15 bg-white/5 ring-[54px] ring-white/5" />
        <PageHeader inverse eyebrow="Asset Custodian" title={`Good day, ${user?.firstName ?? 'there'}`} action={
          <div className="flex flex-wrap gap-2.5 text-sm font-semibold">
            <Link href={`${basePath}/qr-scanner`} className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-3.5 py-2.5 transition hover:bg-white/15">
              <ScanLine aria-hidden="true" className="size-4" />
              Scan asset tag
            </Link>
            <Link href={queuePath} className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 text-blue-950 transition hover:bg-blue-50">
              Open fulfillment
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        } />
      </div>
      <DashboardError message={error} />

      {loading && <p role="status" className="sr-only">Loading dashboard data</p>}
      <section aria-label="Dashboard totals" aria-busy={loading} className="grid grid-cols-2 gap-4 sm:gap-5 @xl:grid-cols-12 @[68rem]:grid-cols-5">
        {metrics.map(({ label, value, icon: Icon, tone, href }, index) => (
          <Link key={label} href={href}
            className={`flex min-h-24 min-w-0 items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-4 shadow-sm transition hover:border-blue-300 sm:gap-3 sm:px-4 @xl:col-span-4 @[68rem]:col-span-1 ${index === 3
              ? '@xl:col-start-3 @[68rem]:col-start-auto'
              : index === 4 ? 'col-span-2' : ''}`}
          >
            <span className={`grid size-8 shrink-0 place-items-center rounded-lg sm:size-10 ${tone}`}>
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <dl className="flex min-w-0 flex-col justify-between gap-1 self-stretch">
              <dt className="text-xs leading-tight font-semibold text-slate-600 sm:text-sm">{label}</dt>
              <dd className="text-2xl leading-none font-bold tracking-tight text-slate-950 tabular-nums sm:text-3xl">
                {value === undefined ? '—' : numberFormat.format(value)}
              </dd>
            </dl>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 sm:gap-5 @[52rem]:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section aria-labelledby="fulfillment-heading" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 id="fulfillment-heading" className="text-lg font-bold tracking-tight text-slate-950">Fulfillment queue</h2>
              <p className="mt-0.5 text-sm text-slate-600">Approved requests awaiting fulfillment</p>
            </div>
            <Link href={queuePath} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
              View queue <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </header>
          {data?.pendingFulfillment.length ? (
            <ul className="divide-y divide-slate-100">
              {data.pendingFulfillment.map((request) => {
                const item = request.items[0];
                const remainingItems = request.items.length - 1;
                const requiredDate = Date.parse(request.requiredDate);
                return (
                  <li key={request.id} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 py-3 sm:flex-nowrap sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                        <ClipboardList aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950 wrap-break-word">{item?.itemDescription ?? 'Requisition'}</p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {request.requestNumber}
                          {item && ` · Qty ${numberFormat.format(item.quantity)}`}
                          {remainingItems > 0 && ` · +${remainingItems} more`}
                        </p>
                      </div>
                    </div>
                    {Number.isFinite(requiredDate) && (
                      <div className="shrink-0 pl-12 text-xs text-slate-600 sm:pl-0 sm:text-right">
                        <span className="sm:block">Required by </span>
                        <time dateTime={request.requiredDate} className="font-semibold text-slate-900">{formatDate(request.requiredDate)}</time>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-6 py-10 text-center text-sm text-slate-600">
              {loading ? 'Loading requests…' : data ? 'No requests are waiting for fulfillment.' : 'Fulfillment data is unavailable.'}
            </p>
          )}
          {data && data.pendingTotal > data.pendingFulfillment.length && (
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600 sm:px-6">
              Showing {data.pendingFulfillment.length} of {numberFormat.format(data.pendingTotal)} pending requests
            </p>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <section aria-labelledby="inventory-heading" className="flex flex-1 flex-col rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6">
            <h2 id="inventory-heading" className="text-lg font-bold tracking-tight text-slate-950">Inventory breakdown</h2>
            <p className="mt-0.5 text-sm text-slate-600">Records by inventory type</p>
            <ul className="mt-3 flex flex-1 flex-col justify-evenly gap-1">
              {inventoryCategories.map(({ type, label, path, icon: Icon, color }) => {
                const count = inventoryByType ? inventoryByType[type] ?? 0 : undefined;
                const share = count && inventoryTotal ? count / inventoryTotal * 100 : 0;
                return (
                  <li key={type}>
                    <Link href={`${basePath}/${path}`} className="group -mx-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50">
                      <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:text-blue-700">
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap justify-between gap-x-2 text-sm font-semibold text-slate-900">
                          <span>{label}</span>
                          <span className="tabular-nums">{count === undefined ? '—' : numberFormat.format(count)}</span>
                        </div>
                        <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${share}%` }} />
                        </div>
                      </div>
                      <ArrowRight aria-hidden="true" className="size-4 text-slate-500 group-hover:text-blue-700" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <Link href={`${basePath}/notifications`} className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-blue-300 sm:px-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Bell aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-950">Notifications</span>
              {data && (
                <span className="text-xs text-slate-600">
                  {data.unreadCount ? `${numberFormat.format(data.unreadCount)} unread` : 'You’re all caught up'}
                </span>
              )}
            </span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-500 group-hover:text-blue-700" />
          </Link>
        </div>
      </div>
    </div>
  );
}
