'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast } from '@/components/ui/Toast';
import { AdminPageHeader, Field, inputClass, Panel, PrimaryButton, SearchToolbar, SecondaryButton, StatusChip, TableWrap, tdClass, thClass } from '@/components/admin/AdminUi';
import { AssetRequestDetail } from './AssetRequestDetail';
import { AttachmentPicker } from './AttachmentPicker';
import { assetRequestsApi, type AssetRequest } from '@/lib/api/asset-requests';
import {
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  REQUEST_TYPE_LABEL,
  completeActionLabel,
  custodianActions,
  fileProblem,
  isOpen,
} from '@/lib/asset-requests/asset-request-rules';
import { formatDate, formatDateTime } from '@/lib/requisitions/requisition-view';

const FILTERS = [
  { value: 'open', label: 'Open (needs action)' },
  { value: 'All', label: 'All requests' },
  { value: 'submitted', label: 'Awaiting approval' },
  { value: 'approved', label: 'Approved — hand-over pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

function errorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(msg) ? msg.join(' · ') : (msg ?? fallback);
}

function attachmentCount(n: number): string {
  if (n === 0) return '';
  return ` · ${n} attachment${n > 1 ? 's' : ''}`;
}

/**
 * Custodian view of Returns & Incidents (IT Asset Custodian for ICT, Property
 * Custodian for Fixed/Supplies — the backend scopes the list). Two steps:
 * Approve (schedule hand-over) → Mark received, which updates the asset and
 * offers the matching COA form.
 */
export function AssetRequestQueue({ eyebrow, openId }: Readonly<{ eyebrow: string; openId?: string }>) {
  const [rows, setRows] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AssetRequest | null>(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [handoverDate, setHandoverDate] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<'' | 'repair' | 'disposal'>('');
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const load = useCallback(
    () => assetRequestsApi.queue().then((res) => setRows(res.data)),
    [],
  );

  useEffect(() => {
    load()
      .catch(() => setLoadError('Failed to load requests. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, [load]);

  // Notification deep-link (?open=<id>) — fetch and open that request.
  const handledOpenId = useRef<string | null>(null);
  useEffect(() => {
    if (!openId || loading || handledOpenId.current === openId) return;
    handledOpenId.current = openId;
    assetRequestsApi
      .getOne(openId)
      .then((res) => setSelected(res.data))
      .catch(() => setLoadError('That request could not be found, or it is handled by another custodian.'));
  }, [openId, loading]);

  const open = (r: AssetRequest | null) => {
    setSelected(r);
    setActionError('');
    setHandoverDate('');
    setNotes('');
    setReason('');
    setOutcome('');
    setReceiptFiles([]);
  };

  const run = async (label: string, action: () => Promise<{ data: AssetRequest }>) => {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      const res = await action();
      setSelected(res.data);
      setNotes('');
      setReason('');
      setReceiptFiles([]);
      notify(`${res.data.requestNumber} ${label}.`);
      await load().catch(() => {});
    } catch (err) {
      setActionError(errorMessage(err, `Could not ${label.replace(/ed$/, '')} the request.`));
    } finally {
      setBusy(false);
    }
  };


  const q = search.toLowerCase();
  const visible = rows
    .filter((r) => {
      if (filter === 'All') return true;
      if (filter === 'open') return isOpen(r);
      return r.status === filter;
    })
    .filter((r) =>
      [r.requestNumber, r.asset?.itemDescription, r.requester?.name, r.requester?.employeeId, REQUEST_TYPE_LABEL[r.type]]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  const openCount = rows.filter(isOpen).length;

  if (loading) return <LoadingSkeleton rows={8} />;

  const actions = selected ? custodianActions(selected.status) : [];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        eyebrow={eyebrow}
        title="Returns & Incidents"
        detail="Return, repair, damage, loss and theft requests from asset holders. Approve to schedule the hand-over, then mark the item received."
      />
      {loadError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{loadError}</div>}
      <SearchToolbar value={search} onChange={setSearch} filterValue={filter} filterOptions={FILTERS} onFilterChange={setFilter} />
      <Panel title="Requests" detail={`${openCount} open · ${rows.length} total`}>
        <TableWrap>
          <table className="w-full min-w-[820px]">
            <thead>
              <tr>
                <th className={thClass}>Request</th>
                <th className={thClass}>Asset</th>
                <th className={thClass}>Requested by</th>
                <th className={thClass}>Filed</th>
                <th className={thClass}>Status</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/40">
                  <td className={tdClass}>
                    <p className="font-bold text-slate-950">{REQUEST_TYPE_LABEL[r.type]}</p>
                    <p className="text-xs text-slate-500">{r.requestNumber}{attachmentCount(r.attachments.length)}</p>
                  </td>
                  <td className={tdClass}>{r.asset?.itemDescription ?? '—'}</td>
                  <td className={tdClass}>
                    <p>{r.requester?.name ?? '—'}</p>
                    <p className="text-xs text-slate-500">{r.requester?.employeeId}</p>
                  </td>
                  <td className={tdClass}>{formatDateTime(r.createdAt)}</td>
                  <td className={tdClass}><StatusChip status={REQUEST_STATUS_LABEL[r.status]} tone={REQUEST_STATUS_TONE[r.status]} /></td>
                  <td className={`${tdClass} text-right`}>
                    <SecondaryButton onClick={() => open(r)}>{isOpen(r) ? 'Review' : 'View'}</SecondaryButton>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">No requests match the current filter.</td></tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Panel>

      <DetailDrawer open={Boolean(selected)} title={selected?.requestNumber ?? 'Request'} onClose={() => open(null)}>
        {selected && (
          <div className="space-y-5">
            <AssetRequestDetail
              request={selected}
              onRegenerate={() => void run('documents generated', () => assetRequestsApi.regenerateDocuments(selected.id))}
            />

            {actions.includes('approve') && (
              <section className="space-y-3 rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-950">Approve</h3>
                {selected.type === 'return' || selected.type === 'repair' || selected.type === 'damage' ? (
                  <Field label="Hand-over date (when the holder should bring it in)">
                    <input type="date" className={inputClass} value={handoverDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setHandoverDate(e.target.value)} />
                  </Field>
                ) : null}
                <Field label="Note to the requester (optional)">
                  <textarea className={`${inputClass} h-20 py-2`} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
                </Field>
                <PrimaryButton disabled={busy} onClick={() => run('approved', () => assetRequestsApi.approve(selected.id, { handoverDate: handoverDate || undefined, notes: notes.trim() || undefined }))}>
                  Approve
                </PrimaryButton>
              </section>
            )}

            {actions.includes('complete') && (
              <section className="space-y-3 rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-950">{completeActionLabel(selected.type)}</h3>
                <p className="text-xs text-slate-500">
                  {selected.type === 'return' && 'Confirms the item is back. The asset becomes Returned and is unassigned from the holder.'}
                  {selected.type === 'repair' && 'Confirms the item was handed over. The asset becomes Under repair.'}
                  {selected.type === 'damage' && 'Confirms the item was handed over. Choose where it goes next.'}
                  {(selected.type === 'loss' || selected.type === 'theft') && 'Records the incident. The asset is flagged for disposal and an RLSDDP is suggested.'}
                </p>
                {selected.type === 'damage' && (
                  <Field label="Outcome">
                    <select className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value as '' | 'repair' | 'disposal')}>
                      <option value="">Choose…</option>
                      <option value="repair">Send to repair</option>
                      <option value="disposal">Flag for disposal (unrepairable)</option>
                    </select>
                  </Field>
                )}
                <Field label="Notes (condition on receipt, etc.)">
                  <textarea className={`${inputClass} h-20 py-2`} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
                </Field>
                <div>
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">Condition photos (optional)</span>
                  <AttachmentPicker files={receiptFiles} onChange={setReceiptFiles} />
                </div>
                <PrimaryButton
                  disabled={busy || (selected.type === 'damage' && !outcome) || Boolean(fileProblem(receiptFiles))}
                  onClick={() => run('completed', () => assetRequestsApi.complete(selected.id, { outcome: outcome || undefined, notes: notes.trim() || undefined, files: receiptFiles }))}
                >
                  {completeActionLabel(selected.type)}
                </PrimaryButton>
              </section>
            )}

            {actions.includes('reject') && (
              <section className="space-y-3 rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-950">Reject</h3>
                <Field label="Reason (sent to the requester)">
                  <textarea className={`${inputClass} h-20 py-2`} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
                </Field>
                <SecondaryButton
                  disabled={busy || !reason.trim()}
                  onClick={() => run('rejected', () => assetRequestsApi.reject(selected.id, reason.trim()))}
                >
                  Reject request
                </SecondaryButton>
              </section>
            )}

            {selected.status === 'approved' && selected.handoverDate && (
              <p className="text-xs text-slate-500">Hand-over scheduled for {formatDate(selected.handoverDate)}.</p>
            )}
            {actionError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{actionError}</p>}
          </div>
        )}
      </DetailDrawer>
      <Toast message={toast} />
    </div>
  );
}
