'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, Clock, User, ArrowLeft } from 'lucide-react';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

const TIMELINE_STEPS = [
  { key: 'DRAFT', label: 'Submitted' },
  { key: 'PENDING_SUPERVISOR', label: 'Supervisor Review' },
  { key: 'PENDING_FULFILLMENT', label: 'IT Fulfillment' },
  { key: 'FULFILLED', label: 'Fulfilled' },
];

function getStepStatus(stepKey: string, currentStatus: string): 'completed' | 'current' | 'pending' {
  const order = ['DRAFT', 'PENDING_SUPERVISOR', 'PENDING_FULFILLMENT', 'FULFILLED'];
  const stepIdx = order.indexOf(stepKey);
  const currentIdx = order.indexOf(currentStatus);
  if (stepIdx < currentIdx) return 'completed';
  if (stepIdx === currentIdx) return 'current';
  return 'pending';
}

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [req, setReq] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    requisitionsApi
      .getOne(id)
      .then((r) => setReq(r.data))
      .catch(() => setError('Requisition not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6"><LoadingSkeleton rows={8} /></div>;
  if (error || !req) return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error || 'Not found.'}</div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#1a4d7a] hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-blue-100">
          <div>
            <h2 className="text-lg font-semibold text-[#1a4d7a]">Requisition #{req.id.slice(0, 8)}</h2>
            <p className="text-sm text-gray-500 mt-1">Submitted {new Date(req.createdAt).toLocaleDateString()}</p>
          </div>
          <StatusBadge status={req.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <span className="text-gray-500">Type</span>
            <p className="font-medium text-gray-800">{req.requisitionType}</p>
          </div>
          <div>
            <span className="text-gray-500">Required Date</span>
            <p className="font-medium text-gray-800">{new Date(req.requiredDate).toLocaleDateString()}</p>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">Justification</span>
            <p className="font-medium text-gray-800">{req.justification}</p>
          </div>
        </div>

        {req.supervisorComments && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4 text-sm">
            <p className="font-medium text-yellow-800">Supervisor Note</p>
            <p className="text-yellow-700 mt-1">{req.supervisorComments}</p>
          </div>
        )}

        <h3 className="text-sm font-semibold text-gray-700 mb-4">Progress Timeline</h3>
        <div className="space-y-0">
          {TIMELINE_STEPS.map((step, index) => {
            const status = getStepStatus(step.key, req.status);
            return (
              <div key={step.key} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    status === 'completed' ? 'bg-green-100 border-green-300 text-green-600'
                    : status === 'current' ? 'bg-blue-100 border-blue-300 text-blue-600'
                    : 'bg-gray-100 border-gray-300 text-gray-400'
                  }`}>
                    {status === 'completed' ? <CheckCircle className="w-4 h-4" />
                      : status === 'current' ? <Clock className="w-4 h-4" />
                      : <User className="w-4 h-4" />}
                  </div>
                  {index < TIMELINE_STEPS.length - 1 && (
                    <div className={`w-0.5 h-10 ${status === 'completed' ? 'bg-green-300' : 'bg-gray-200'}`} />
                  )}
                </div>
                <div className={`flex-1 mb-0 px-4 py-2.5 rounded-md border ${
                  status === 'completed' ? 'border-green-200 bg-green-50'
                  : status === 'current' ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-200 bg-gray-50'
                } ${index < TIMELINE_STEPS.length - 1 ? 'mb-3' : ''}`}>
                  <p className="text-sm font-medium text-gray-800">{step.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">{status}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
