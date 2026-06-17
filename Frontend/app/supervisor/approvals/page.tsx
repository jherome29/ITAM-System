'use client';

import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { PageHeader } from '@/components/ui/PageHeader';
import { RequisitionTable } from '@/components/shared/RequisitionTable';

export default function ApprovalsPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requisitionsApi
      .list(1, 50, 'PENDING_SUPERVISOR')
      .then((r) => setRequisitions(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Pending Approvals" />

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">Awaiting Your Review</h2>
        </div>
        <RequisitionTable
          requisitions={requisitions}
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
