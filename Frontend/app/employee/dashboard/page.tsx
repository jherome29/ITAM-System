'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, CheckCircle, XCircle, FileText } from 'lucide-react';
import { requisitionsApi, type Requisition, type RequisitionStats } from '@/lib/api/requisitions';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function EmployeeDashboard() {
  const [stats, setStats] = useState<RequisitionStats | null>(null);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([requisitionsApi.stats(), requisitionsApi.mine(1, 10)])
      .then(([s, r]) => {
        setStats(s.data);
        setRequisitions(r.data.data);
      })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Dashboard"
        action={
          <Link
            href="/employee/requisitions/new"
            className="bg-[#1a4d7a] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] transition-colors duration-150"
          >
            Submit New Requisition
          </Link>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Clock} iconColor="text-yellow-500" label="Pending" value={stats?.pending ?? '—'} />
        <StatCard icon={CheckCircle} iconColor="text-green-600" label="Approved / Fulfilled" value={stats ? (stats.approved + stats.fulfilled) : '—'} />
        <StatCard icon={XCircle} iconColor="text-red-500" label="Rejected" value={stats?.rejected ?? '—'} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">My Requisitions</h2>
        </div>

        {loading ? (
          <div className="p-6"><LoadingSkeleton rows={5} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['ID', 'Items', 'Type', 'Required Date', 'Status'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requisitions.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">No requisitions yet.</td></tr>
                ) : (
                  requisitions.map((req) => (
                    <tr key={req.id} className="hover:bg-blue-50 transition-colors duration-100">
                      <td className="px-6 py-4 text-sm text-gray-600">#{req.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{req.items.map((i) => i.itemDescription).join(', ')}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{req.requisitionType}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{new Date(req.requiredDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <Link href={`/employee/requisitions/${req.id}`}>
                          <StatusBadge status={req.status} />
                        </Link>
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
