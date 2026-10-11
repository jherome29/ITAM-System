'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCcw, Send } from 'lucide-react';
import { Field, inputClass, PrimaryButton } from '@/components/admin/AdminUi';
import { CatalogueItemPicker } from '@/components/requisitions/CatalogueItemPicker';
import type { CatalogueItem, MyAsset } from '@/lib/api/assets';
import { requisitionsApi, type CreateRequisitionDto, type Requisition } from '@/lib/api/requisitions';
import { MAX_REQUEST_QUANTITY, maxRequestQuantity } from '@/lib/requisitions/catalogue-items';

// Shared by every role that can submit a requisition (Employee, Approving
// Officer, IT Asset Custodian). Submits directly to POST /v1/requisitions with
// a single line item. The item normally comes from the inventory picker, which
// fixes assetType/assetClass to the real record; the "Can't find it?" fallback
// lets the requester describe something not in stock — the server then flags
// that line inInventory=false for the custodian.
export interface RequisitionFormValues {
  requisitionType: string;
  justification: string;
  requiredDate: string;
  itemDescription: string;
  quantity: string;
  assetType: string;
  assetClass: string;
  replacedAssetId: string;
}

export type DerivedRequisitionType = 'new' | 'supply' | 'replacement';

export const REQUISITION_TYPE_LABEL: Record<DerivedRequisitionType, string> = {
  new: 'New item',
  supply: 'Supply',
  replacement: 'Replacement',
};

/**
 * The request type follows from what is being requested — it is never picked
 * by hand. A replacement is started from My Assigned Assets on an asset that
 * qualifies; otherwise a supply (IES) item is 'supply' and anything else
 * 'new'. Repairs are not requisitions at all: they are filed from My Assigned
 * Assets → Request repair (Returns & Incidents).
 */
export function deriveRequisitionType(
  replacing: boolean,
  item: Pick<CatalogueItem, 'isSupply' | 'assetClass'> | null,
): DerivedRequisitionType {
  if (replacing) return 'replacement';
  if (item?.isSupply || item?.assetClass === 'IES') return 'supply';
  return 'new';
}

// Raw form values → API payload. `replacedAssetId` rides along only for a
// replacement request with a non-blank value; the backend rejects a
// replacement without it (CLAUDE.md §17).
export function buildCreateRequisitionDto(v: RequisitionFormValues): CreateRequisitionDto {
  const dto: CreateRequisitionDto = {
    requisitionType: v.requisitionType,
    justification: v.justification,
    requiredDate: v.requiredDate,
    items: [{
      itemDescription: v.itemDescription,
      quantity: Number(v.quantity),
      assetType: v.assetType,
      assetClass: v.assetClass,
      justification: v.justification,
    }],
  };
  const replacedAssetId = v.replacedAssetId.trim();
  if (v.requisitionType === 'replacement' && replacedAssetId) {
    dto.replacedAssetId = replacedAssetId;
  }
  return dto;
}

export function RequisitionForm({
  defaultItem = null,
  replacing = null,
  onSubmit,
}: Readonly<{
  defaultItem?: CatalogueItem | null;
  /** Start a replacement for this asset (from My Assigned Assets). */
  replacing?: MyAsset | null;
  onSubmit: (created: Requisition) => void;
}>) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(false);
  const [manualClass, setManualClass] = useState(replacing?.assetClass ?? 'SEP');
  const [picked, setPicked] = useState<CatalogueItem | null>(defaultItem);

  const requisitionType = deriveRequisitionType(
    Boolean(replacing),
    manual ? { isSupply: false, assetClass: manualClass } : picked,
  );

  const pick = (item: CatalogueItem | null) => {
    setPicked(item);
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!manual && !picked) {
      setError('Choose an item from inventory, or use "Can\'t find it?" to describe one.');
      return;
    }
    const data = new FormData(event.currentTarget);
    const dto = buildCreateRequisitionDto({
      requisitionType,
      justification: String(data.get('justification')),
      requiredDate: String(data.get('requiredDate')),
      itemDescription: manual ? String(data.get('itemDescription')) : picked!.itemDescription,
      quantity: replacing ? '1' : String(data.get('quantity')),
      assetType: manual ? (replacing?.assetType ?? String(data.get('assetType'))) : picked!.assetType,
      assetClass: manual ? manualClass : picked!.assetClass,
      replacedAssetId: replacing?.id ?? '',
    });
    setSubmitting(true);
    try {
      const res = await requisitionsApi.create(dto);
      onSubmit(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to submit requisition.'));
    } finally {
      setSubmitting(false);
    }
  };

  const maxQty = manual ? MAX_REQUEST_QUANTITY : maxRequestQuantity(picked);

  return <form className="space-y-4" onSubmit={handleSubmit}>
    {error && <div className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

    {replacing && (
      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        <RefreshCcw className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-slate-950">Replacing {replacing.itemDescription}</p>
          <p className="mt-0.5">{[replacing.propertyNumber, `${replacing.assetType} · ${replacing.assetClass}`].filter(Boolean).join(' · ')}</p>
          <p className="mt-1">{replacing.replacement.reason} Pick the {replacing.assetType} item you need instead. Your current unit is collected when the replacement is issued.</p>
        </div>
      </div>
    )}

    {manual ? (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>This item will be marked <b>not in inventory</b>. The custodian may need to put it on hold until it can be sourced.</p>
        </div>
        <Field label="Describe the item"><input name="itemDescription" required className={inputClass} placeholder="e.g. 27-inch monitor, USB-C docking station" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {!replacing && <Field label="Asset type"><select name="assetType" defaultValue="ICT" className={inputClass}><option value="ICT">ICT</option><option value="Fixed">Fixed</option><option value="Supplies">Supplies</option></select></Field>}
          <Field label="Asset class"><select name="assetClass" value={manualClass} onChange={(e) => setManualClass(e.target.value)} className={inputClass}><option value="PPE">PPE</option><option value="SEP">SEP</option>{!replacing && <option value="IES">IES</option>}</select></Field>
        </div>
        <button type="button" onClick={() => setManual(false)} className="text-xs font-bold text-blue-700 hover:underline">← Back to inventory search</button>
      </div>
    ) : (
      <div className="space-y-1.5">
        <span className="block text-xs font-bold text-slate-600">{replacing ? 'Replacement item from inventory' : 'Item from inventory'}</span>
        <CatalogueItemPicker selected={picked} onSelect={pick} lockedAssetType={replacing?.assetType} unitsOnly={Boolean(replacing)} />
        {!picked && (
          <button type="button" onClick={() => { setManual(true); setPicked(null); }} className="text-xs font-bold text-blue-700 hover:underline">Can&apos;t find it? Describe the item</button>
        )}
      </div>
    )}

    <div className="flex items-center gap-2 text-xs">
      <span className="font-bold text-slate-600">Request type</span>
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-700 ring-1 ring-slate-200">{REQUISITION_TYPE_LABEL[requisitionType]}</span>
      {!replacing && <span className="text-slate-500">To repair or replace an asset you hold, use My Assigned Assets.</span>}
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      {replacing
        ? <Field label="Quantity"><input value="1" readOnly className={`${inputClass} bg-slate-50`} aria-describedby="replacement-qty" /><span id="replacement-qty" className="mt-1 block text-xs text-slate-500">One-for-one replacement.</span></Field>
        : <Field label={manual || !picked ? 'Quantity' : `Quantity (max ${maxQty})`}><input key={maxQty} name="quantity" type="number" min="1" max={maxQty} defaultValue="1" required className={inputClass} /></Field>}
      <Field label="Required date"><input name="requiredDate" required type="date" min={new Date().toISOString().slice(0, 10)} className={inputClass} /></Field>
    </div>
    <Field label="Business justification"><textarea name="justification" required minLength={20} className={`${inputClass} h-28 py-2`} placeholder={replacing ? 'Describe what is wrong with your current unit and how it affects your work.' : 'Explain the operational need and intended use.'} /></Field>
    <div className="border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">Submission routes to your assigned Approving Officer. Availability and issuance are confirmed by the responsible custodian after approval.</div>
    <PrimaryButton type="submit" icon={Send} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit requisition'}</PrimaryButton>
  </form>;
}
