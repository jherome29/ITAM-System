'use client';

import Link from 'next/link';
import { type Requisition } from '@/lib/api/requisitions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

interface RequisitionTableProps {
  requisitions: Requisition[];
  loading: boolean;
  actionLabel: string;
  getActionHref: (id: string) => string;
  emptyMessage?: string;
  showRequestor?: boolean;
  showSubmittedAt?: boolean;
}

export function RequisitionTable({
  requisitions,
  loading,
  actionLabel,
  getActionHref,
  emptyMessage = 'No requisitions found.',
  showRequestor = false,
  showSubmittedAt = false,
}: RequisitionTableProps) {
  const headers = [
    'ID',
    ...(showRequestor ? ['Requestor'] : []),
    'Items',
    'Type',
    'Required Date',
    ...(showSubmittedAt ? ['Submitted'] : []),
    'Status',
    '',
  ];

  if (loading) {
    return <div className="p-6"><LoadingSkeleton rows={6} /></div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {requisitions.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-6 py-10 text-center text-sm text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            requisitions.map((req) => (
              <tr key={req.id} className="hover:bg-blue-50 transition-colors duration-100">
                <td className="px-6 py-4 text-sm text-gray-500">#{req.id.slice(0, 8)}</td>
                {showRequestor && (
                  <td className="px-6 py-4 text-xs font-mono text-gray-500">#{req.requestedById.slice(0, 8)}</td>
                )}
                <td className="px-6 py-4 text-sm text-gray-700">{req.items.map((i) => i.itemDescription).join(', ')}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{req.requisitionType}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{new Date(req.requiredDate).toLocaleDateString()}</td>
                {showSubmittedAt && (
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(req.createdAt).toLocaleDateString()}</td>
                )}
                <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                <td className="px-6 py-4">
                  <Link href={getActionHref(req.id)} className="text-[#1a4d7a] text-sm font-medium hover:underline">
                    {actionLabel}
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
