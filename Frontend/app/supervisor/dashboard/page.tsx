'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle, XCircle, Clock, ClipboardList } from 'lucide-react';
import { requisitionsApi, type Requisition, type RequisitionStats } from '@/lib/api/requisitions';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { RequisitionTable } from '@/components/shared/RequisitionTable';

export default function SupervisorDashboard() {
  const [stats, setStats] = useState<RequisitionStats | null>(null);
  const [pending, setPending] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      requisitionsApi.stats(),
      requisitionsApi.list(1, 10, 'PENDING_SUPERVISOR'),
    ])
      .then(([s, r]) => {
        setStats(s.data);
        setPending(r.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Supervisor Dashboard" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={AlertCircle} iconColor="text-yellow-500" label="Pending Review" value={stats?.pending ?? '—'} />
        <StatCard icon={CheckCircle} iconColor="text-green-600" label="Approved" value={stats?.approved ?? '—'} />
        <StatCard icon={XCircle} iconColor="text-red-500" label="Rejected" value={stats?.rejected ?? '—'} />
        <StatCard icon={Clock} iconColor="text-blue-600" label="Total" value={stats?.total ?? '—'} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#1a4d7a]" />
            <h2 className="text-base font-semibold text-[#1a4d7a]">Pending Approval Queue</h2>
          </div>
          <Link href="/supervisor/approvals" className="text-sm text-[#1a4d7a] font-medium hover:underline">
            View all
          </Link>
        </div>
        <RequisitionTable
          requisitions={pending}
          loading={loading}
          actionLabel="Review"
          getActionHref={(id) => `/supervisor/approvals/${id}`}
          emptyMessage="No pending requisitions."
          showRequestor
        />
      </div>
    </div>
  );
}
