'use client';

import { ClipboardCheck, ClipboardList } from 'lucide-react';
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

export function ApprovingOfficerDashboard() {
  const { data, loading, error } = useRoleDashboardData(async () => {
    const [pendingRes, statsRes, notifRes] = await Promise.all([
      requisitionsApi.list(1, 15, 'pending_supervisor'),
      requisitionsApi.stats(),
      notificationsApi.list(),
    ]);
    return {
      pendingApprovals: pendingRes.data.data,
      pendingTotal: pendingRes.data.total,
      stats: statsRes.data,
      unreadCount: notifRes.data.unreadCount,
    };
  });

  if (loading) {
    return <LoadingSkeleton rows={8} />;
  }

  const pendingApprovals = data?.pendingApprovals ?? [];
  const pendingTotal = data?.pendingTotal ?? 0;
  const stats = data?.stats ?? null;
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5">
      <RoleDashboardHeader eyebrow="Approving Officer" />
      <DashboardError message={error} />

      <div className="grid gap-3 sm:grid-cols-2">
        <KpiTile icon={ClipboardCheck} tone="amber" label="Pending my approval" value={pendingTotal} href="/approving-officer/approvals" />
        <KpiTile icon={ClipboardList} tone="blue" label="My own requisitions" value={stats?.total ?? 0} href="/approving-officer/requisitions" />
      </div>

      <RequisitionListSection
        title="Awaiting My Approval"
        items={pendingApprovals}
        href="/approving-officer/approvals"
        emptyText="Nothing awaiting your approval right now."
      />

      <NotificationsFooter count={unreadCount} href="/approving-officer/notifications" />
    </div>
  );
}
