'use client';

import { useState } from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import { Field, inputClass, PrimaryButton } from '@/components/admin/AdminUi';
import { CatalogueItemPicker } from '@/components/requisitions/CatalogueItemPicker';
import type { CatalogueItem } from '@/lib/api/assets';
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
  onSubmit,
}: Readonly<{ defaultItem?: CatalogueItem | null; onSubmit: (created: Requisition) => void }>) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(false);
  const [picked, setPicked] = useState<CatalogueItem | null>(defaultItem);
  const [requisitionType, setRequisitionType] = useState(defaultItem?.isSupply ? 'supply' : 'new');

  const pick = (item: CatalogueItem | null) => {
    setPicked(item);
    setError('');
    // Supplies are requested as 'supply'; flip back when a unit asset is picked.
    if (item?.isSupply && requisitionType === 'new') setRequisitionType('supply');
    if (item && !item.isSupply && requisitionType === 'supply') setRequisitionType('new');
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
      requisitionType: String(data.get('requisitionType')),
      justification: String(data.get('justification')),
      requiredDate: String(data.get('requiredDate')),
      itemDescription: manual ? String(data.get('itemDescription')) : picked!.itemDescription,
      quantity: String(data.get('quantity')),
      assetType: manual ? String(data.get('assetType')) : picked!.assetType,
      assetClass: manual ? String(data.get('assetClass')) : picked!.assetClass,
      replacedAssetId: String(data.get('replacedAssetId') ?? ''),
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

    {manual ? (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>This item will be marked <b>not in inventory</b>. The custodian may need to put it on hold until it can be sourced.</p>
        </div>
        <Field label="Describe the item"><input name="itemDescription" required className={inputClass} placeholder="e.g. 27-inch monitor, USB-C docking station" /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Asset type"><select name="assetType" defaultValue="ICT" className={inputClass}><option value="ICT">ICT</option><option value="Fixed">Fixed</option><option value="Supplies">Supplies</option></select></Field><Field label="Asset class"><select name="assetClass" defaultValue="SEP" className={inputClass}><option value="PPE">PPE</option><option value="SEP">SEP</option><option value="IES">IES</option></select></Field></div>
        <button type="button" onClick={() => setManual(false)} className="text-xs font-bold text-blue-700 hover:underline">← Back to inventory search</button>
      </div>
    ) : (
      <div className="space-y-1.5">
        <span className="block text-xs font-bold text-slate-600">Item from inventory</span>
        <CatalogueItemPicker selected={picked} onSelect={pick} />
        {!picked && (
          <button type="button" onClick={() => { setManual(true); setPicked(null); }} className="text-xs font-bold text-blue-700 hover:underline">Can&apos;t find it? Describe the item</button>
        )}
      </div>
    )}

    <Field label="Request type"><select name="requisitionType" value={requisitionType} onChange={(e) => setRequisitionType(e.target.value)} className={inputClass}><option value="new">New</option><option value="replacement">Replacement</option><option value="repair">Repair</option><option value="supply">Supply</option></select></Field>
    {requisitionType === 'replacement' && (
      <Field label="Asset ID of the item being replaced"><input name="replacedAssetId" required className={inputClass} placeholder="Copy the Asset ID from that asset's detail page" /></Field>
    )}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={manual || !picked ? 'Quantity' : `Quantity (max ${maxQty})`}><input key={maxQty} name="quantity" type="number" min="1" max={maxQty} defaultValue="1" required className={inputClass} /></Field>
      <Field label="Required date"><input name="requiredDate" required type="date" className={inputClass} /></Field>
    </div>
    <Field label="Business justification"><textarea name="justification" required minLength={20} className={`${inputClass} h-28 py-2`} placeholder="Explain the operational need and intended use." /></Field>
    <div className="border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">Submission routes to your assigned Approving Officer. Availability and issuance are confirmed by the responsible custodian after approval.</div>
    <PrimaryButton type="submit" icon={Send} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit requisition'}</PrimaryButton>
  </form>;
}
