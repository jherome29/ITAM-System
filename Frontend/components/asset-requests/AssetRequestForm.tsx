'use client';

import { useMemo, useState } from 'react';
import { Field, inputClass, PrimaryButton } from '@/components/admin/AdminUi';
import { AttachmentPicker } from './AttachmentPicker';
import type { Asset } from '@/lib/api/assets';
import { assetRequestsApi, type AssetRequest, type AssetRequestType } from '@/lib/api/asset-requests';
import {
  ALL_REQUEST_TYPES,
  REQUEST_TYPE_LABEL,
  allowedTypes,
  blockingRequest,
  fileProblem,
} from '@/lib/asset-requests/asset-request-rules';

const today = () => new Date().toISOString().slice(0, 10);

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

  const blocker = blockingRequest(type, forAsset);
  const asset = issued.find((a) => a.id === assetId);
  const isReturn = type === 'return';

  const submit = async () => {
    setError('');
    if (!assetId) return setError('Choose an asset.');
    if (blocker) return setError(`${blocker.requestNumber} is still open for this asset.`);
    if (!date) return setError(isReturn ? 'Choose a preferred return date.' : 'Enter the date it happened.');
    if (details.trim().length < 15) return setError('Details must be at least 15 characters.');
    const problem = fileProblem(files);
    if (problem) return setError(problem);
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
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      {fixedAssetId && asset ? (
        <div className="rounded-md border border-slate-200 p-3 text-sm">
          <p className="font-bold text-slate-950">{asset.itemDescription}</p>
          <p className="mt-1 text-xs text-slate-500">{[asset.propertyNumber, asset.serialNumber && `Serial ${asset.serialNumber}`].filter(Boolean).join(' · ') || asset.assetType}</p>
        </div>
      ) : (
        <Field label="Asset">
          <select className={inputClass} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            {issued.map((a) => <option key={a.id} value={a.id}>{a.itemDescription}{a.propertyNumber ? ` (${a.propertyNumber})` : ''}</option>)}
          </select>
        </Field>
      )}

      {!fixedType && (
        <Field label="Request type">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as AssetRequestType)}>
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

      <Field label={isReturn ? 'Preferred return date' : 'Date it happened'}>
        <input
          type="date"
          className={inputClass}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          {...(isReturn ? { min: today() } : { max: today() })}
        />
      </Field>
      <Field label="Details and justification">
        <textarea
          className={`${inputClass} h-28 py-2`}
          value={details}
          maxLength={2000}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={isReturn ? 'Why you are returning it and its current condition.' : 'Describe what happened and the current condition.'}
        />
      </Field>
      <div>
        <span className="mb-1.5 block text-xs font-bold text-slate-600">Photos or documents (optional)</span>
        <AttachmentPicker files={files} onChange={setFiles} />
      </div>
      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <PrimaryButton type="submit" disabled={submitting || Boolean(blocker)}>
        {submitting ? 'Submitting…' : `Submit ${REQUEST_TYPE_LABEL[type].toLowerCase()}`}
      </PrimaryButton>
    </form>
  );
}
