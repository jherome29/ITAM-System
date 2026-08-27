'use client';

import { Boxes, CheckCircle2, ClipboardList, Wrench } from 'lucide-react';
import { assetsApi } from '@/lib/api/assets';
import { requisitionsApi } from '@/lib/api/requisitions';
import { notificationsApi } from '@/lib/api/notifications';
import {
  DashboardError,
  KpiTile,
  NotificationsFooter,
  RequisitionListSection,
  RoleDashboardHeader,
  useRoleDashboardData,
} from '@/components/dashboard/RoleDashboardShell';

export function ItAssetCustodianDashboard() {
  const { data, loading, error } = useRoleDashboardData(async () => {
    const [statsRes, reqRes, notifRes] = await Promise.all([
      assetsApi.stats(),
      requisitionsApi.list(1, 15, 'pending_fulfillment'),
      notificationsApi.list(),
    ]);
    return {
      stats: statsRes.data,
      pendingFulfillment: reqRes.data.data,
      unreadCount: notifRes.data.unreadCount,
    };
  });

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading dashboard...</div>;
  }

  const stats = data?.stats ?? null;
  const pendingFulfillment = data?.pendingFulfillment ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5">
      <RoleDashboardHeader eyebrow="ICT Asset Custodian" />
      <DashboardError message={error} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile icon={Boxes} tone="blue" label="Total assets" value={stats?.total ?? 0} href="/it-asset-custodian/assets" />
        <KpiTile icon={CheckCircle2} tone="emerald" label="Available" value={stats?.available ?? 0} href="/it-asset-custodian/assets" />
        <KpiTile icon={ClipboardList} tone="amber" label="Pending fulfillment" value={pendingFulfillment.length} href="/it-asset-custodian/fulfillment" />
        <KpiTile icon={Wrench} tone="red" label="Under repair" value={stats?.underRepair ?? 0} href="/it-asset-custodian/maintenance" />
      </div>

      <RequisitionListSection
        title="Awaiting Fulfillment"
        items={pendingFulfillment}
        href="/it-asset-custodian/fulfillment"
        emptyText="Nothing awaiting fulfillment right now."
      />

      <NotificationsFooter count={unreadCount} href="/it-asset-custodian/notifications" />
    </div>
  );
}
