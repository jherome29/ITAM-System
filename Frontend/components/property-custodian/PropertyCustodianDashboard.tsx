'use client';

import { Archive, Boxes, CheckCircle2, ClipboardList } from 'lucide-react';
import { assetsApi } from '@/lib/api/assets';
import { requisitionsApi } from '@/lib/api/requisitions';
import { notificationsApi } from '@/lib/api/notifications';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  DashboardError,
  KpiTile,
  NotificationsFooter,
  RequisitionListSection,
  RoleDashboardHeader,
  useRoleDashboardData,
} from '@/components/dashboard/RoleDashboardShell';

export function PropertyCustodianDashboard() {
  const { data, loading, error } = useRoleDashboardData(async () => {
    const [statsRes, reqRes, notifRes] = await Promise.all([
      assetsApi.stats(),
      requisitionsApi.list(1, 15, 'pending_fulfillment'),
      notificationsApi.list(),
    ]);
    return {
      stats: statsRes.data,
      pendingFulfillment: reqRes.data.data,
      pendingTotal: reqRes.data.total,
      unreadCount: notifRes.data.unreadCount,
    };
  });

  if (loading) {
    return <LoadingSkeleton rows={8} />;
  }

  const stats = data?.stats ?? null;
  const pendingFulfillment = data?.pendingFulfillment ?? [];
  const pendingTotal = data?.pendingTotal ?? 0;
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5">
      <RoleDashboardHeader eyebrow="Property Custodian" />
      <DashboardError message={error} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile icon={Boxes} tone="blue" label="Total assets (Fixed + Supplies)" value={stats?.total ?? 0} />
        <KpiTile icon={CheckCircle2} tone="emerald" label="Available" value={stats?.available ?? 0} />
        <KpiTile icon={ClipboardList} tone="amber" label="Pending fulfillment" value={pendingTotal} href="/property-custodian/fulfillment" />
        <KpiTile icon={Archive} tone="red" label="Flagged for disposal" value={stats?.flaggedForDisposal ?? 0} href="/property-custodian/disposal" />
      </div>

      <RequisitionListSection
        title="Awaiting Fulfillment"
        items={pendingFulfillment}
        href="/property-custodian/fulfillment"
        emptyText="Nothing awaiting fulfillment right now."
      />

      <NotificationsFooter count={unreadCount} href="/property-custodian/notifications" />
    </div>
  );
}
