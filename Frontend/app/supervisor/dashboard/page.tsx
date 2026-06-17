'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle, XCircle, Clock, ClipboardList } from 'lucide-react';
import { requisitionsApi, type Requisition, type RequisitionStats } from '@/lib/api/requisitions';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

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
        {loading ? (
          <div className="p-6"><LoadingSkeleton rows={4} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['ID', 'Requestor', 'Items', 'Type', 'Required Date', 'Status', ''].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pending.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">No pending requisitions.</td></tr>
                ) : (
                  pending.map((req) => (
                    <tr key={req.id} className="hover:bg-blue-50 transition-colors duration-100">
                      <td className="px-6 py-4 text-sm text-gray-500">#{req.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-500">#{req.requestedById.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{req.items.map((i) => i.itemDescription).join(', ')}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{req.requisitionType}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{new Date(req.requiredDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                      <td className="px-6 py-4">
                        <Link href={`/supervisor/approvals/${req.id}`} className="text-[#1a4d7a] text-sm font-medium hover:underline">Review</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
