'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { List } from 'lucide-react';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

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
        {loading ? (
          <div className="p-6"><LoadingSkeleton rows={6} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['ID', 'Items', 'Type', 'Required Date', 'Submitted', 'Status', ''].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requisitions.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">No requisitions found.</td></tr>
                ) : (
                  requisitions.map((req) => (
                    <tr key={req.id} className="hover:bg-blue-50 transition-colors duration-100">
                      <td className="px-6 py-4 text-sm text-gray-500">#{req.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{req.items.map((i) => i.itemDescription).join(', ')}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{req.requisitionType}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{new Date(req.requiredDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{new Date(req.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                      <td className="px-6 py-4">
                        <Link href={`/employee/requisitions/${req.id}`} className="text-[#1a4d7a] text-sm font-medium hover:underline">View</Link>
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
