'use client';

import { useState } from 'react';
import { CheckSquare, FileDown } from 'lucide-react';
import { StatusChip } from '@/components/admin/AdminUi';
import { AttachmentGallery } from './AttachmentGallery';
import { assetRequestsApi, type AssetRequest, type AssetRequestDocument } from '@/lib/api/asset-requests';
import {
  FORM_LABEL,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  REQUEST_TYPE_LABEL,
  nextSteps,
  outcomeSummary,
} from '@/lib/asset-requests/asset-request-rules';
import { downloadBlob } from '@/lib/download';
import { formatDate, formatDateTime } from '@/lib/requisitions/requisition-view';

interface Step {
  label: string;
  at: string | null;
  note?: string | null;
}

function timeline(r: AssetRequest): Step[] {
  const steps: Step[] = [{ label: `Submitted by ${r.requester?.name ?? 'requester'}`, at: r.createdAt }];
  if (r.status === 'rejected') {
    steps.push({ label: `Rejected by ${r.decidedBy?.name ?? 'custodian'}`, at: r.decidedAt, note: r.decisionNotes });
    return steps;
  }
  if (r.decidedAt) {
    const handover = r.handoverDate ? ` · hand-over ${formatDate(r.handoverDate)}` : '';
    steps.push({ label: `Approved by ${r.decidedBy?.name ?? 'custodian'}${handover}`, at: r.decidedAt, note: r.decisionNotes });
  }
  if (r.status === 'completed') {
    const result = r.resultingStatus ? ` · asset now ${r.resultingStatus.replaceAll('_', ' ')}` : '';
    steps.push({ label: `Completed by ${r.completedBy?.name ?? 'custodian'}${result}`, at: r.completedAt, note: r.completionNotes });
  }
  if (r.status === 'cancelled') steps.push({ label: 'Cancelled by requester', at: r.cancelledAt });
  return steps;
}

const OUTCOME_STYLE = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
} as const;

/** Official COA documents for a completed request, each downloadable. */
function DocumentsSection({ request: r, onRegenerate }: Readonly<{ request: AssetRequest; onRegenerate?: () => void }>) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const download = async (doc: AssetRequestDocument) => {
    setBusy(doc.id);
    setError('');
    try {
      const blob = await assetRequestsApi.document(r.id, doc.id);
      downloadBlob(blob, `${doc.formType}-${r.requestNumber}.pdf`);
    } catch {
      setError('The document could not be downloaded. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-slate-950">Official documents</h3>
      {r.documents.length === 0 && r.missingDocuments.length === 0 && (
        <p className="text-sm text-slate-600">
          No COA form applies to a repair request. This record and the condition photos serve as the hand-over record.
        </p>
      )}
      <ul className="space-y-2">
        {r.documents.map((doc) => (
          <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3 text-sm">
            <span>
              <span className="font-semibold text-slate-800">{doc.label}</span>
              <span className="block text-xs text-slate-500">Generated {formatDateTime(doc.generatedAt)}</span>
            </span>
            <button
              type="button"
              disabled={busy === doc.id}
              onClick={() => void download(doc)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" /> {busy === doc.id ? 'Downloading…' : 'Download PDF'}
            </button>
          </li>
        ))}
      </ul>
      {r.missingDocuments.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>Still being prepared: {r.missingDocuments.map((f) => FORM_LABEL[f] ?? f).join(', ')}.</p>
          {onRegenerate && (
            <button type="button" onClick={onRegenerate} className="mt-2 text-xs font-bold text-blue-700 hover:underline">
              Generate missing documents
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      {r.documents.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Printed copies are signed at the custodian&apos;s office; this digital copy is kept for COA audit reference.
        </p>
      )}
    </div>
  );
}

/**
 * `audience` — 'requester' adds the hand-over checklist once approved;
 * `onRegenerate` (custodian only) retries documents that failed to generate.
 */
export function AssetRequestDetail({
  request: r,
  audience = 'custodian',
  onRegenerate,
}: Readonly<{ request: AssetRequest; audience?: 'requester' | 'custodian'; onRegenerate?: () => void }>) {
  const steps = audience === 'requester' ? nextSteps(r) : null;
  const outcome = outcomeSummary(r);
  const facts: Array<[string, string]> = [
    ['Type', REQUEST_TYPE_LABEL[r.type]],
    [r.type === 'return' ? 'Preferred return date' : 'Date it happened', formatDate(r.preferredDate)],
    ['Requested by', r.requester ? `${r.requester.name} · ${r.requester.employeeId}` : '—'],
    ['Handled by', r.custodianLabel ?? '—'],
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-950">{r.asset?.itemDescription ?? 'Asset'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {[r.asset?.propertyNumber, r.asset?.serialNumber && `Serial ${r.asset.serialNumber}`, r.asset?.assetType].filter(Boolean).join(' · ')}
          </p>
        </div>
        <StatusChip status={REQUEST_STATUS_LABEL[r.status]} tone={REQUEST_STATUS_TONE[r.status]} />
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      {outcome && (
        <p className={`rounded-lg border p-3 text-sm font-semibold ${OUTCOME_STYLE[outcome.tone]}`}>{outcome.text}</p>
      )}

      {steps && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-bold text-blue-950">{steps.title}</h3>
          <ul className="mt-2 space-y-1">
            {steps.bring.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-blue-950">
                <CheckSquare className="mt-0.5 h-4 w-4 flex-none text-blue-700" /> {item}
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 text-xs text-blue-900">
            {steps.notes.map((n) => <p key={n}>{n}</p>)}
            <p>Quote reference <span className="font-bold">{r.requestNumber}</span> at the counter.</p>
          </div>
        </section>
      )}

      <div>
        <h3 className="mb-1 text-sm font-bold text-slate-950">Details</h3>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{r.details}</p>
      </div>

      {r.status === 'completed' && <DocumentsSection request={r} onRegenerate={onRegenerate} />}

      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-950">Attachments from requester</h3>
        <AttachmentGallery requestId={r.id} attachments={r.attachments.filter((a) => a.stage !== 'receipt')} />
      </div>

      {r.attachments.some((a) => a.stage === 'receipt') && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-950">Condition on receipt</h3>
          <AttachmentGallery requestId={r.id} attachments={r.attachments.filter((a) => a.stage === 'receipt')} />
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-950">Progress</h3>
        <ol className="space-y-2">
          {timeline(r).map((step, i) => (
            <li key={`${step.label}-${i}`} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-slate-800">{step.label}</span>
                <span className="shrink-0 text-xs text-slate-500">{step.at ? formatDateTime(step.at) : ''}</span>
              </div>
              {step.note && <p className="mt-1 text-slate-600">“{step.note}”</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
