'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { List } from 'lucide-react';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { PageHeader } from '@/components/ui/PageHeader';
import { RequisitionTable } from '@/components/shared/RequisitionTable';

export default function MyRequisitionsPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    requisitionsApi
      .mine()
      .then((r) => setRequisitions(r.data.data))
      .catch(() => setError('Failed to load requisitions.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Requisitions"
        action={
          <Link
            href="/employee/requisitions/new"
            className="bg-[#1a4d7a] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] transition-colors duration-150"
          >
            New Request
          </Link>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <List className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">All Requisitions</h2>
        </div>
        <RequisitionTable
          requisitions={requisitions}
          loading={loading}
          actionLabel="View"
          getActionHref={(id) => `/employee/requisitions/${id}`}
          emptyMessage="No requisitions found."
          showSubmittedAt
        />
      </div>
    </div>
  );
}
