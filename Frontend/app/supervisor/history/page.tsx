'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, XCircle, Search, History } from 'lucide-react';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function ApprovalHistoryPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requisitionsApi
      .list(1, 100)
      .then((r) => {
        const resolved = r.data.data.filter((req) =>
          ['FULFILLED', 'REJECTED', 'CANCELLED'].includes(req.status)
        );
        setRequisitions(resolved);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return requisitions.filter(
      (r) =>
        r.requestedById.toLowerCase().includes(q) ||
        r.items.some((i) => i.itemDescription.toLowerCase().includes(q))
    );
  }, [search, requisitions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval History"
        action={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by requestor or item..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors"
            />
          </div>
        }
      />

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <History className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">Resolved Requisitions</h2>
        </div>
        {loading ? (
          <div className="p-6"><LoadingSkeleton rows={6} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['ID', 'Requestor', 'Items', 'Decision', 'Date', 'Comment'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">No history found.</td></tr>
                ) : (
                  filtered.map((req) => (
                    <tr key={req.id} className="hover:bg-blue-50 transition-colors duration-100">
                      <td className="px-6 py-4 text-sm text-gray-500">#{req.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-500">#{req.requestedById.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{req.items.map((i) => i.itemDescription).join(', ')}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {req.status === 'REJECTED' ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                          <span className="text-sm text-gray-700 capitalize">{req.status.toLowerCase().replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{new Date(req.updatedAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{req.supervisorComments ?? '—'}</td>
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
