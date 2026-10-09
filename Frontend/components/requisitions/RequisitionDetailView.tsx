'use client';

import { AlertTriangle } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import type { Requisition } from '@/lib/api/requisitions';
import {
  formatDate,
  formatDateTime,
  requesterLabel,
  requisitionStatusLabel,
  requisitionTimeline,
  slaBadge,
  type SlaTone,
} from '@/lib/requisitions/requisition-view';

export const slaToneClass: Record<SlaTone, string> = {
  red: 'bg-red-50 text-red-700 ring-red-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function SlaBadge({ request }: Readonly<{ request: Pick<Requisition, 'status' | 'slaDeadline'> }>) {
  const sla = slaBadge(request);
  if (!sla) return null;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${slaToneClass[sla.tone]}`}>{sla.label}</span>;
}

/**
 * Real-data requisition detail, shared by every role's requisition views
 * (Employee drawer + detail page, Approval Queue, fulfilment queues, My
 * Requisitions). Identifies people by name/employee ID — never by UUID — and
 * builds the timeline from the stored decision timestamps.
 */
export function RequisitionDetailView({ request }: Readonly<{ request: Requisition }>) {
  const items = request.items ?? [];
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const facts: Array<[string, string]> = [
    ['Request No.', request.requestNumber],
    ['Requested by', requesterLabel(request.requester)],
    ['Approving officer', request.approver ? `${request.approver.name} · ${request.approver.employeeId}` : 'Not yet assigned'],
    ['Request type', request.requisitionType.replaceAll('_', ' ')],
    ['Total quantity', String(totalQty)],
    ['Required by', formatDate(request.requiredDate)],
  ];

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-lg font-bold text-slate-950">{items.map((item) => item.itemDescription).join(', ') || 'Requisition'}</p>
        <p className="mt-1 text-xs text-slate-500">{request.requestNumber} · Submitted {formatDateTime(request.submittedAt)}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <StatusBadge status={request.status} label={requisitionStatusLabel(request.status)} />
        <SlaBadge request={request} />
      </div>
    </div>

    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {facts.map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 p-3"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd></div>)}
    </dl>

    <div>
      <p className="text-xs font-bold text-slate-500">Items requested</p>
      <div className="mt-2 space-y-2">
        {items.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-800">{item.itemDescription}</p>
            {item.inInventory === false && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200"><AlertTriangle className="h-3 w-3" aria-hidden="true" />Not in inventory</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">{item.assetType} · {item.assetClass} · Qty {item.quantity}</p>
        </div>)}
      </div>
    </div>

    <div><p className="text-xs font-bold text-slate-500">Justification</p><p className="mt-2 whitespace-pre-line text-sm text-slate-700">{request.justification}</p></div>

    <div>
      <p className="text-xs font-bold text-slate-500">Progress</p>
      <ol className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
        {requisitionTimeline(request).map((step, index) => <li key={step.label} className="flex items-start gap-3 px-3 py-2.5">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-800">{step.label}</p>
            {step.note && <p className="mt-0.5 text-xs text-slate-500">“{step.note}”</p>}
          </div>
          {step.at && <span className="shrink-0 text-xs text-slate-500">{formatDateTime(step.at)}</span>}
        </li>)}
      </ol>
    </div>
  </div>;
}
