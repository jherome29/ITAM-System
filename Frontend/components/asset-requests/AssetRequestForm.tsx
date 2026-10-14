'use client';

import { useMemo, useState } from 'react';
import { Field, inputClass, PrimaryButton } from '@/components/admin/AdminUi';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { localToday } from '@/lib/dates';
import { formatDate } from '@/lib/requisitions/requisition-view';
import { AttachmentPicker } from './AttachmentPicker';
import type { Asset } from '@/lib/api/assets';
import { assetRequestsApi, type AssetRequest, type AssetRequestType } from '@/lib/api/asset-requests';
import {
  ALL_REQUEST_TYPES,
  REQUEST_DATE_COPY,
  REQUEST_DETAILS_PLACEHOLDER,
  REQUEST_TYPE_LABEL,
  allowedTypes,
  filingConsequences,
  blockingRequest,
  supersededRequests,
  fileProblem,
} from '@/lib/asset-requests/asset-request-rules';

/**
 * Files a return / repair / damage / loss / theft request on an asset the user
 * holds. `fixedAssetId` / `fixedType` lock those fields when opened from an
 * asset card; otherwise the user picks both. Type options already blocked by
 * an open request on that asset are disabled (the server enforces the same).
 */
export function AssetRequestForm({
  assets,
  myRequests,
  fixedAssetId,
  fixedType,
  initialType,
  onSubmitted,
}: Readonly<{
  assets: Asset[];
  myRequests: AssetRequest[];
  fixedAssetId?: string;
  fixedType?: AssetRequestType;
  initialType?: AssetRequestType;
  onSubmitted: (request: AssetRequest) => void;
}>) {
  const issued = assets.filter((a) => a.status === 'issued');
  const [assetId, setAssetId] = useState(fixedAssetId ?? issued[0]?.id ?? '');
  const forAsset = useMemo(() => myRequests.filter((r) => r.asset?.id === assetId), [myRequests, assetId]);
  const allowed = allowedTypes(forAsset);
  const [type, setType] = useState<AssetRequestType>(fixedType ?? initialType ?? allowed[0] ?? 'return');
  const [date, setDate] = useState('');
  const [details, setDetails] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // A message is about the last attempt — drop it as soon as the user edits.
  const edit = <T,>(set: (value: T) => void) => (value: T) => { setError(''); set(value); };

  const blocker = blockingRequest(type, forAsset);
  const closes = supersededRequests(type, forAsset);
  const asset = issued.find((a) => a.id === assetId);
  const dateCopy = REQUEST_DATE_COPY[type];
  const today = localToday();

  // Validate, then ask the holder to confirm what filing locks on the item.
  const review = () => {
    setError('');
    if (!assetId) return setError('Choose an asset.');
    if (blocker) return setError(`${blocker.requestNumber} is still open for this asset.`);
    if (!date) return setError(dateCopy.missing);
    if (dateCopy.future ? date < today : date > today) {
      return setError(dateCopy.future ? 'The return date cannot be in the past.' : 'The date cannot be in the future.');
    }
    if (details.trim().length < 15) return setError('Details must be at least 15 characters.');
    const problem = fileProblem(files);
    if (problem) return setError(problem);
    setConfirming(true);
  };

  const submit = async () => {
    setConfirming(false);
    setSubmitting(true);
    try {
      const res = await assetRequestsApi.create({ assetId, type, preferredDate: date, details: details.trim(), files });
      onSubmitted(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Could not submit the request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (issued.length === 0) {
    return <p className="text-sm text-slate-600">You have no issued assets to file a request for.</p>;
  }

  return (
    <form className="space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); review(); }}>
      {fixedAssetId && asset ? (
        <div className="rounded-md border border-slate-200 p-3 text-sm">
          <p className="font-bold text-slate-950">{asset.itemDescription}</p>
          <p className="mt-1 text-xs text-slate-500">{[asset.propertyNumber, asset.serialNumber && `Serial ${asset.serialNumber}`].filter(Boolean).join(' · ') || asset.assetType}</p>
        </div>
      ) : (
        <Field label="Asset">
          <select className={inputClass} value={assetId} onChange={(e) => edit(setAssetId)(e.target.value)}>
            {issued.map((a) => <option key={a.id} value={a.id}>{a.itemDescription}{a.propertyNumber ? ` (${a.propertyNumber})` : ''}</option>)}
          </select>
        </Field>
      )}

      {!fixedType && (
        <Field label="Request type">
          <select className={inputClass} value={type} onChange={(e) => edit(setType)(e.target.value as AssetRequestType)}>
            {ALL_REQUEST_TYPES.map((t) => (
              <option key={t} value={t} disabled={!allowed.includes(t)}>
                {REQUEST_TYPE_LABEL[t]}{allowed.includes(t) ? '' : ' — another request is open'}
              </option>
            ))}
          </select>
        </Field>
      )}

      {blocker && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          {blocker.requestNumber} ({REQUEST_TYPE_LABEL[blocker.type].toLowerCase()}) is still open for this asset. Cancel it from Returns &amp; Incidents or wait until the custodian closes it.
        </p>
      )}

      {closes.length > 0 && (
        <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          Filing this closes {closes.map((r) => `${r.requestNumber} (${REQUEST_TYPE_LABEL[r.type].toLowerCase()})`).join(', ')} — the item can no longer be handed over, so the custodian handles it as a {REQUEST_TYPE_LABEL[type].toLowerCase()} instead.
        </p>
      )}

      <Field label={dateCopy.label}>
        <input
          type="date"
          className={inputClass}
          value={date}
          aria-describedby="request-date-hint"
          onChange={(e) => edit(setDate)(e.target.value)}
          {...(dateCopy.future ? { min: today } : { max: today })}
        />
        <span id="request-date-hint" className="mt-1 block text-xs text-slate-500">{dateCopy.hint}</span>
      </Field>
      <Field label="Details and justification">
        <textarea
          className={`${inputClass} h-28 py-2`}
          value={details}
          maxLength={2000}
          onChange={(e) => edit(setDetails)(e.target.value)}
          placeholder={REQUEST_DETAILS_PLACEHOLDER[type]}
        />
      </Field>
      <div>
        <span className="mb-1.5 block text-xs font-bold text-slate-600">Photos or documents (optional)</span>
        <AttachmentPicker files={files} onChange={edit(setFiles)} />
      </div>
      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <PrimaryButton type="submit" disabled={submitting || Boolean(blocker)}>
        {submitting ? 'Submitting…' : `Review and submit`}
      </PrimaryButton>

      <ConfirmDialog
        open={confirming}
        title={`Submit this ${REQUEST_TYPE_LABEL[type].toLowerCase()}?`}
        detail={`${asset?.itemDescription ?? 'Asset'} · ${dateCopy.detailLabel}: ${formatDate(date)}`}
        confirmLabel={`Submit ${REQUEST_TYPE_LABEL[type].toLowerCase()}`}
        onConfirm={() => void submit()}
        onCancel={() => setConfirming(false)}
      >
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          {filingConsequences(type, asset?.assetType ?? '', closes).map((line) => <li key={line}>{line}</li>)}
        </ul>
      </ConfirmDialog>
    </form>
  );
}
