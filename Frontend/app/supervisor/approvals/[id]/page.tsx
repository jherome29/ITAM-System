'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, FileText, ArrowLeft } from 'lucide-react';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function RequisitionReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [req, setReq] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    requisitionsApi
      .getOne(id)
      .then((r) => setReq(r.data))
      .catch(() => setError('Requisition not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await requisitionsApi.approve(id, comment || undefined);
      router.push('/supervisor/approvals');
    } catch {
      setError('Failed to approve. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!id || !comment.trim()) {
      setError('A reason is required to reject a requisition.');
      return;
    }
    setActionLoading(true);
    try {
      await requisitionsApi.reject(id, comment);
      router.push('/supervisor/approvals');
    } catch {
      setError('Failed to reject. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-6"><LoadingSkeleton rows={8} /></div>;
  if (!req) return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error || 'Not found.'}</div>;

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors';

  return (
    <div className="max-w-3xl space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#1a4d7a] hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-100 flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#1a4d7a]" />
          <h1 className="text-xl font-semibold text-[#1a4d7a]">Review Requisition #{req.id.slice(0, 8)}</h1>
          <div className="ml-auto"><StatusBadge status={req.status} /></div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Requestor</p>
              <p className="font-medium text-gray-800 font-mono text-xs">#{req.requestedById.slice(0, 8)}</p>
            </div>
            <div>
              <p className="text-gray-500">Submitted</p>
              <p className="font-medium text-gray-800">{new Date(req.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500">Type</p>
              <p className="font-medium text-gray-800">{req.requisitionType}</p>
            </div>
            <div>
              <p className="text-gray-500">Required Date</p>
              <p className="font-medium text-gray-800">{new Date(req.requiredDate).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500 mb-2">Items Requested</p>
            <ul className="space-y-1">
              {req.items.map((item) => (
                <li key={item.id} className="text-sm text-gray-800 flex justify-between">
                  <span>{item.itemDescription}</span>
                  <span className="text-gray-500">Qty: {item.quantity} · {item.assetType}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500 mb-1">Justification</p>
            <p className="text-sm text-gray-800">{req.justification}</p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comment <span className="text-gray-400 font-normal">(required for rejection)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className={inputClass}
              rows={3}
              placeholder="Add your comments..."
            />
          </div>

          {req.status === 'PENDING_SUPERVISOR' && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors duration-150"
              >
                <CheckCircle className="w-4 h-4" />
                {actionLoading ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors duration-150"
              >
                <XCircle className="w-4 h-4" />
                {actionLoading ? 'Processing...' : 'Reject'}
              </button>
              <button
                onClick={() => router.back()}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors duration-150"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
