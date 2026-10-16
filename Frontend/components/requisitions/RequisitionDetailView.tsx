'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, FileDown } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { requisitionsApi, type Requisition, type RequisitionDocument } from '@/lib/api/requisitions';
import { FORM_LABEL } from '@/lib/asset-requests/asset-request-rules';
import { downloadBlob } from '@/lib/download';
import {
  formatDate,
  formatDateTime,
  requesterLabel,
  requisitionStatusLabel,
  requisitionTimeline,
  slaBadge,
  type SlaTone,
} from '@/lib/requisitions/requisition-view';
import { Chip } from '@/components/ui/Chip';
import type { Tone } from '@/components/ui/tones';

// The SLA countdown is a chip in the shared tones: red once overdue, amber when close.
const SLA_TONE: Record<SlaTone, Tone> = { red: 'red', amber: 'amber', slate: 'slate' };

export function SlaBadge({ request }: Readonly<{ request: Pick<Requisition, 'status' | 'slaDeadline'> }>) {
  const sla = slaBadge(request);
  if (!sla) return null;
  return <Chip tone={SLA_TONE[sla.tone]}>{sla.label}</Chip>;
}

/**
 * The unit a replacement requisition replaces — what the approver weighs and
 * what the custodian collects. Fulfilling the requisition returns it to
 * custody (unless it was reported lost/stolen, when there is nothing to collect).
 */
function ReplacedAssetPanel({ request }: Readonly<{ request: Requisition }>) {
  const old = request.replacedAsset!;
  const lostOrWrittenOff = old.status === 'flagged_for_disposal';
  const done = request.status === 'fulfilled';
  let handover = 'The requester hands this unit back when the replacement is issued; fulfilling marks it Returned and generates its receipt.';
  if (lostOrWrittenOff) handover = 'Reported lost, stolen or written off — there is no unit to collect.';
  else if (done) handover = old.status === 'returned' ? 'Returned to custody when the replacement was issued.' : `Now ${old.status.replaceAll('_', ' ')}.`;
  return <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
    <p className="text-xs font-bold text-blue-900">Replaces</p>
    <p className="mt-1 font-semibold text-slate-900">{old.itemDescription}</p>
    <p className="mt-0.5 text-xs text-slate-600">
      {[old.propertyNumber, old.serialNumber && `Serial ${old.serialNumber}`, `${old.assetType} · ${old.assetClass}`, `Condition: ${old.condition.replaceAll('_', ' ')}`, old.acquisitionDate && `Acquired ${formatDate(old.acquisitionDate)}`].filter(Boolean).join(' · ')}
    </p>
    {old.components && !lostOrWrittenOff && <p className="mt-0.5 text-xs text-slate-600">Components to collect: {old.components}</p>}
    <p className="mt-2 text-xs text-blue-900">{handover}</p>
  </div>;
}

/**
 * COA documents generated for a fulfilled requisition — today the receipt for
 * the unit surrendered on a replacement — downloadable by anyone who can read
 * the request, the requester included. List rows carry no documents, so they
 * are fetched from the detail endpoint when absent.
 */
function DocumentsSection({ request }: Readonly<{ request: Requisition }>) {
  const [docs, setDocs] = useState<RequisitionDocument[] | null>(request.documents ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (request.documents || request.status !== 'fulfilled') return;
    let live = true;
    requisitionsApi.getOne(request.id).then((res) => { if (live) setDocs(res.data.documents ?? []); }).catch(() => { if (live) setDocs([]); });
    return () => { live = false; };
  }, [request.id, request.status, request.documents]);

  if (!docs || docs.length === 0) return null;

  const download = async (doc: RequisitionDocument) => {
    setBusy(doc.id);
    setError('');
    try {
      downloadBlob(await requisitionsApi.document(request.id, doc.id), `${doc.formType}-${request.requestNumber}.pdf`);
    } catch {
      setError('The document could not be downloaded. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return <div>
    <p className="text-xs font-bold text-slate-500">Official documents</p>
    <ul className="mt-2 space-y-2">
      {docs.map((doc) => <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
        <span>
          <span className="font-semibold text-slate-800">{FORM_LABEL[doc.formType] ?? doc.formType.replaceAll('_', ' ')}</span>
          <span className="block text-xs text-slate-500">Generated {formatDateTime(doc.generatedAt)}</span>
        </span>
        <button type="button" disabled={busy === doc.id} onClick={() => void download(doc)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
          <FileDown className="h-4 w-4" aria-hidden="true" /> {busy === doc.id ? 'Downloading…' : 'Download PDF'}
        </button>
      </li>)}
    </ul>
    {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
    <p className="mt-2 text-xs text-slate-500">Printed copies are signed at the custodian&apos;s office; this digital copy is kept for COA audit reference.</p>
  </div>;
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

    {request.replacedAsset && <ReplacedAssetPanel request={request} />}

    <div>
      <p className="text-xs font-bold text-slate-500">Items requested</p>
      <div className="mt-2 space-y-2">
        {items.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-800">{item.itemDescription}</p>
            {item.inInventory === false && <Chip tone="amber" icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}>Not in inventory</Chip>}
          </div>
          <p className="mt-1 text-xs text-slate-500">{item.assetType} · {item.assetClass} · Qty {item.quantity}</p>
        </div>)}
      </div>
    </div>

    <DocumentsSection key={request.id} request={request} />

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
