'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function FulfillRequisitionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [req, setReq] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [fulfilling, setFulfilling] = useState(false);
  const [holding, setHolding] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [showHoldForm, setShowHoldForm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    requisitionsApi.getOne(id).then((r) => setReq(r.data)).catch(() => setError('Not found.')).finally(() => setLoading(false));
  }, [id]);

  const handleFulfill = async () => {
    if (!id) return;
    setFulfilling(true);
    try {
      await requisitionsApi.fulfill(id);
      router.push('/it-personnel/requisitions');
    } catch {
      setError('Failed to fulfill. Please try again.');
    } finally {
      setFulfilling(false);
    }
  };

  const handleHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !holdReason.trim()) return;
    setHolding(true);
    try {
      await requisitionsApi.hold(id, holdReason);
      router.push('/it-personnel/requisitions');
    } catch {
      setError('Failed to place on hold.');
    } finally {
      setHolding(false);
    }
  };

  if (loading) return <div className="p-6"><LoadingSkeleton rows={8} /></div>;
  if (!req) return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error || 'Not found.'}</div>;

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors';

  return (
    <div className="max-w-2xl space-y-4">
      <button type="button" onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#1a4d7a] hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-100 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[#1a4d7a]">Fulfill Requisition #{req.id.slice(0, 8)}</h1>
          <StatusBadge status={req.status} />
        </div>

        <div className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Requestor</p><p className="font-medium font-mono text-xs">#{req.requestedById.slice(0, 8)}</p></div>
            <div><p className="text-gray-500">Type</p><p className="font-medium">{req.requisitionType}</p></div>
            <div><p className="text-gray-500">Required Date</p><p className="font-medium">{new Date(req.requiredDate).toLocaleDateString()}</p></div>
            <div><p className="text-gray-500">Submitted</p><p className="font-medium">{new Date(req.createdAt).toLocaleDateString()}</p></div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500 mb-2">Items</p>
            <ul className="space-y-1">
              {req.items.map((item) => (
                <li key={item.id} className="text-sm flex justify-between text-gray-800">
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

          {req.status === 'PENDING_FULFILLMENT' && !showHoldForm && (
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={handleFulfill} disabled={fulfilling} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors">
                <CheckCircle className="w-4 h-4" />
                {fulfilling ? 'Processing...' : 'Mark as Fulfilled'}
              </button>
              <button type="button" onClick={() => setShowHoldForm(true)} className="flex items-center gap-2 bg-yellow-500 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-yellow-600 transition-colors">
                <AlertCircle className="w-4 h-4" /> Place on Hold
              </button>
            </div>
          )}

          {showHoldForm && (
            <form onSubmit={handleHold} className="border-t border-gray-100 pt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Hold *</label>
                <textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} rows={3} className={inputClass} placeholder="Explain why this is being placed on hold..." required />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={holding} className="bg-yellow-500 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-yellow-600 disabled:opacity-60 transition-colors">
                  {holding ? 'Processing...' : 'Confirm Hold'}
                </button>
                <button type="button" onClick={() => setShowHoldForm(false)} className="bg-gray-100 text-gray-700 px-5 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
