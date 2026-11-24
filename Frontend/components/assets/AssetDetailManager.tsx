'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, QrCode, Pencil, Save, X, Clock, ImagePlus, Printer, Trash2 } from 'lucide-react';
import { assetsApi, type Asset, type UpdateAssetDto } from '@/lib/api/assets';
import { auditApi, type AuditLog } from '@/lib/api/audit';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ASSET_LIFECYCLE_TRANSITIONS as NEXT_TRANSITIONS } from '@/lib/assets/lifecycle-transitions';
import { AssetPhoto } from '@/components/assets/AssetPhoto';
import { showAssetBarcode } from '@/lib/assets/print-asset-barcode';

function optionLabel(value: string): string {
  return value.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function Detail({ label, value }: Readonly<{ label: string; value?: string | number | null }>) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</dt>
      <dd className={`text-sm wrap-anywhere ${value ? 'text-gray-800' : 'text-gray-300 italic'}`}>{value ?? 'Not specified'}</dd>
    </div>
  );
}

function DetailSection({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="mb-4 border-b border-slate-100 pb-3 text-sm font-semibold text-[#1a4d7a]">{title}</h2>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-4">{children}</dl>
    </section>
  );
}

function EditableDetail({
  label,
  field,
  value,
  editValue,
  edit,
  onChange,
  type = 'text',
  options,
}: Readonly<{
  label: string;
  field: string;
  value?: string | number | null;
  editValue?: string | number;
  edit: boolean;
  onChange: (field: string, val: string) => void;
  type?: string;
  options?: string[];
}>) {
  const cls = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a]';
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</dt>
      {edit ? (
        options ? (
          <select value={editValue ?? ''} onChange={(e) => onChange(field, e.target.value)} className={cls}>
            <option value="">— select —</option>
            {options.map((o) => <option key={o} value={o}>{optionLabel(o)}</option>)}
          </select>
        ) : (
          <input
            type={type}
            value={editValue ?? ''}
            onChange={(e) => onChange(field, e.target.value)}
            className={cls}
          />
        )
      ) : (
        <dd className={`text-sm wrap-anywhere ${value ? 'text-gray-800' : 'text-gray-300 italic'}`}>{value ?? 'Not specified'}</dd>
      )}
    </div>
  );
}

function buildEditForm(a: Asset): UpdateAssetDto {
  return {
    sapClassification: a.sapClassification,
    itemCode: a.itemCode,
    itemDescription: a.itemDescription,
    brand: a.brand,
    serialNumber: a.serialNumber,
    propertyNumber: a.propertyNumber,
    components: a.components,
    acquisitionCost: a.acquisitionCost,
    acquisitionDate: a.acquisitionDate,
    accountableOfficer: a.accountableOfficer,
    division: a.division,
    officeOrSection: a.officeOrSection,
    officeLocation: a.officeLocation,
    condition: a.condition,
    supplier: a.supplier,
    dateOfDelivery: a.dateOfDelivery,
    quantity: a.quantity,
    reorderLevel: a.reorderLevel ?? undefined,
  };
}

export function AssetDetailManager({ assetId, basePath, formsPath }: Readonly<{ assetId: string; basePath: string; formsPath: string }>) {
  const router = useRouter();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLifecycle, setShowLifecycle] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [lifecycleNotes, setLifecycleNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [lifecycleError, setLifecycleError] = useState('');
  const [lifecycleEmployeeId, setLifecycleEmployeeId] = useState('');
  const [lifecycleToLocation, setLifecycleToLocation] = useState('');
  const [lifecycleExpectedReturnDate, setLifecycleExpectedReturnDate] = useState('');

  const [edit, setEdit] = useState(false);
  const [editForm, setEditForm] = useState<UpdateAssetDto>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [transactions, setTransactions] = useState<AuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [formSuggestion, setFormSuggestion] = useState<string | null>(null);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [tagAction, setTagAction] = useState<'qr' | 'barcode' | null>(null);

  useEffect(() => {
    Promise.all([
      assetsApi.getOne(assetId).then((res) => {
        setAsset(res.data);
        setEditForm(buildEditForm(res.data));
      }),
      auditApi.byRecord(assetId).then((res) => setTransactions(res.data?.data ?? [])).catch(() => {}),
    ])
      .catch(() => {})
      .finally(() => { setLoading(false); setHistoryLoading(false); });
  }, [assetId]);

  const generateTags = async (id: string) => {
    const { data: { qrCode, barcodeValue } } = await assetsApi.generateQr(id);
    setAsset((prev) => prev?.id === id ? { ...prev, qrCode, barcodeValue } : prev);
    return barcodeValue;
  };

  const handleGenerateQr = async () => {
    if (!asset) return;
    setTagAction('qr');
    setSaveError('');
    try {
      await generateTags(asset.id);
    } catch {
      setSaveError('Failed to generate QR code. Please try again.');
    } finally {
      setTagAction(null);
    }
  };

  const handlePrintBarcode = async () => {
    if (!asset) return;
    const propertyCode = asset.propertyNumber?.trim();
    if (asset.assetType === 'Supplies' && !propertyCode) {
      setSaveError('Add and save a Property Supplies Code before printing a barcode.');
      return;
    }

    const preview = window.open('', '_blank', 'popup,width=680,height=420');
    if (!preview) {
      setSaveError('Allow pop-ups for AIMRS to open the barcode print preview.');
      return;
    }

    preview.opener = null;
    preview.document.body.textContent = 'Preparing barcode…';
    setTagAction('barcode');
    setSaveError('');
    try {
      const barcodeValue = asset.barcodeValue || await generateTags(asset.id);
      await showAssetBarcode(preview, asset.itemDescription, propertyCode || barcodeValue, barcodeValue);
    } catch {
      preview.close();
      setSaveError('Could not prepare the barcode. Please try again.');
    } finally {
      setTagAction(null);
    }
  };

  const handleLifecycleUpdate = async () => {
    const statusSnapshot = targetStatus;
    if (!asset || !statusSnapshot) return;
    setUpdating(true);
    setLifecycleError('');
    try {
      const res = statusSnapshot === 'flagged_for_disposal'
        ? await assetsApi.markUnserviceable(asset.id, lifecycleNotes)
        : await assetsApi.updateLifecycle(asset.id, {
        status: statusSnapshot,
        notes: lifecycleNotes || undefined,
        employeeId: lifecycleEmployeeId || undefined,
        toLocation: lifecycleToLocation || undefined,
        expectedReturnDate: lifecycleExpectedReturnDate || undefined,
      });
      setAsset(res.data);
      setShowLifecycle(false);
      setTargetStatus('');
      setLifecycleNotes('');
      setLifecycleEmployeeId('');
      setLifecycleToLocation('');
      setLifecycleExpectedReturnDate('');
      // Refresh audit history after lifecycle change
      auditApi.byRecord(assetId).then((r) => setTransactions(r.data?.data ?? [])).catch(() => {});
      // Suggest relevant COA form
      const cls = res.data.assetClass;
      if (statusSnapshot === 'issued') {
        setFormSuggestion(cls === 'PPE' ? 'PAR' : 'ICS');
      } else if (statusSnapshot === 'transferred') {
        setFormSuggestion('PTR');
      } else if (statusSnapshot === 'flagged_for_disposal') {
        setFormSuggestion('IIRUP');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setLifecycleError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Update failed.'));
    } finally {
      setUpdating(false);
    }
  };

  const handleSave = async () => {
    if (!asset) return;
    setSaving(true);
    setSaveError('');
    try {
      const payload = asset.assetType === 'Supplies'
        ? { ...editForm, propertyNumber: editForm.propertyNumber?.trim() || null }
        : editForm;
      const res = await assetsApi.update(asset.id, payload);
      setAsset(res.data);
      setEdit(false);
      auditApi.byRecord(assetId).then((r) => setTransactions(r.data?.data ?? [])).catch(() => {});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSaveError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to save.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!asset) return;
    setEdit(false);
    setSaveError('');
    setEditForm(buildEditForm(asset));
  };

  const handlePhoto = async (file?: File) => {
    if (!asset || !file) return;
    if (file.size > 5 * 1024 * 1024) { setSaveError('Device photo must be 5 MB or smaller.'); return; }
    setPhotoSaving(true); setSaveError('');
    try { const res = await assetsApi.uploadPhoto(asset.id, file); setAsset(res.data); setPhotoVersion((v) => v + 1); }
    catch { setSaveError('Could not save the device photo. Use a JPEG, PNG, or WebP up to 5 MB.'); }
    finally { setPhotoSaving(false); }
  };

  const handleDeletePhoto = async () => {
    if (!asset) return;
    setPhotoSaving(true);
    try { const res = await assetsApi.deletePhoto(asset.id); setAsset(res.data); setPhotoVersion((v) => v + 1); }
    catch { setSaveError('Could not remove the device photo.'); }
    finally { setPhotoSaving(false); }
  };

  if (loading) return <div className="p-6"><LoadingSkeleton rows={10} /></div>;
  if (!asset) return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">Asset not found.</div>;

  const needsDisposalAssessment = asset.status === 'flagged_for_disposal' && asset.condition !== 'unserviceable';
  const nextStates = needsDisposalAssessment ? ['flagged_for_disposal'] : (NEXT_TRANSITIONS[asset.status] ?? []).filter((status) =>
    status !== 'disposed' &&
    !(status === 'issued' && ['unserviceable', 'for_disposal'].includes(asset.condition)),
  );

  return (
    <div className="@container mx-auto w-full max-w-[1480px] space-y-5">
      {basePath.startsWith('/asset-custodian/disposed-assets/') ? (
        <Link href={basePath} className="inline-flex items-center gap-2 text-sm text-[#1a4d7a] hover:underline">
          <ArrowLeft className="size-4" /> Back to Disposed Assets
        </Link>
      ) : (
        <button type="button" onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#1a4d7a] hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Inventory
        </button>
      )}

      <header className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 @lg:grid-cols-[9rem_minmax(0,1fr)] @lg:items-center @lg:gap-x-5 @lg:p-5">
        <AssetPhoto assetId={asset.id} hasPhoto={Boolean(asset.photoFileName)} version={photoVersion} alt={asset.itemDescription}
          className="grid aspect-[4/3] w-full max-w-44 place-items-center rounded-lg bg-slate-100 text-slate-400"
          fallback={<ImagePlus aria-hidden="true" className="size-9" />} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
            <div className="min-w-0 flex-1 basis-52">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight text-[#1a4d7a] wrap-anywhere">{asset.itemDescription}</h1>
                <StatusBadge status={asset.status} />
              </div>
              {asset.propertyNumber && (
                <p className="mt-1 font-mono text-sm text-gray-500 wrap-anywhere">
                  {asset.assetType === 'Supplies' ? 'Property Supplies Code' : 'Property #'}: {asset.propertyNumber}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {edit ? (
                <>
                  <button type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
                  >
                    <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button"
                    onClick={handleCancelEdit}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </>
              ) : (
                <>
                  <button type="button"
                    onClick={() => setEdit(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                {!asset.qrCode && (
                    <button type="button"
                      onClick={handleGenerateQr}
                    disabled={tagAction !== null}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                    >
                    <QrCode className="w-4 h-4" /> {tagAction === 'qr' ? 'Generating…' : 'Generate QR'}
                    </button>
                  )}
                <button type="button"
                  onClick={handlePrintBarcode}
                  disabled={tagAction !== null}
                  className="flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
                >
                  <Printer aria-hidden="true" className="size-4" />
                  {tagAction === 'barcode' ? 'Preparing…' : 'Print Barcode'}
                </button>
                  {nextStates.length > 0 && (
                    <button type="button"
                      onClick={() => setShowLifecycle(true)}
                      className="px-4 py-2 bg-[#1a4d7a] text-white rounded-md text-sm font-medium hover:bg-[#143d61] transition-colors"
                    >
                      Update Lifecycle
                    </button>
                  )}
                  {asset.status === 'flagged_for_disposal' && !needsDisposalAssessment && (
                    <Link href="/asset-custodian/disposal" className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-[#1a4d7a] hover:bg-gray-50">
                      Open Disposal Recommendations
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-[#1a4d7a] focus-within:ring-2 focus-within:ring-blue-500 hover:bg-slate-50">
              {photoSaving ? 'Saving...' : asset.photoFileName ? 'Replace photo' : 'Add photo'}
              <input className="sr-only" type="file" disabled={photoSaving} accept="image/jpeg,image/png,image/webp" onChange={(e) => void handlePhoto(e.target.files?.[0])} />
            </label>
            {asset.photoFileName && <button type="button" disabled={photoSaving} onClick={() => void handleDeletePhoto()} className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Remove photo</button>}
          </div>
        </div>
      </header>

      {needsDisposalAssessment && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This asset was flagged earlier. It enters Disposal Recommendations only after an assessment confirms it is unserviceable.
        </p>
      )}
      {asset.qrCode && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <QrCode className="w-5 h-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-800">QR Code Generated</p>
            <code className="text-sm font-mono text-green-700">{asset.qrCode}</code>
          </div>
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{saveError}</div>
      )}

      {formSuggestion && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-md px-4 py-3">
          <span>
            Lifecycle updated. Consider generating a <strong>{formSuggestion}</strong> form for this transaction.
          </span>
          <div className="flex gap-2 shrink-0">
            <button type="button"
              onClick={() => router.push(formsPath)}
              className="px-3 py-1 bg-[#1a4d7a] text-white rounded text-xs font-medium hover:bg-[#143d61] transition-colors"
            >
              Go to Forms
            </button>
            <button type="button"
              onClick={() => setFormSuggestion(null)}
              className="px-3 py-1 border border-blue-300 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 @xl:grid-cols-2 @[72rem]:grid-cols-4">
        <DetailSection title="Classification">
          <EditableDetail label="SAP Classification" field="sapClassification" value={asset.sapClassification} editValue={editForm.sapClassification} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          <EditableDetail label={asset.assetType === 'Supplies' ? 'Stock Item Code' : 'Item Code'} field="itemCode" value={asset.itemCode} editValue={editForm.itemCode} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          {asset.assetType === 'Supplies' && (
            <EditableDetail label="Property Supplies Code" field="propertyNumber" value={asset.propertyNumber}
              editValue={editForm.propertyNumber ?? ''} edit={edit}
              onChange={(_, propertyNumber) => setEditForm((prev) => ({ ...prev, propertyNumber }))} />
          )}
          <EditableDetail label="Item Description" field="itemDescription" value={asset.itemDescription} editValue={editForm.itemDescription} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          <EditableDetail label="Brand" field="brand" value={asset.brand} editValue={editForm.brand} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          <EditableDetail label="Serial Number" field="serialNumber" value={asset.serialNumber} editValue={editForm.serialNumber} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          <EditableDetail label="Asset Class" field="assetClass" value={asset.assetClass} edit={false} onChange={() => {}} />
          <EditableDetail label="Asset Type" field="assetType" value={asset.assetType} edit={false} onChange={() => {}} />
        </DetailSection>

        <DetailSection title="Accountability">
          <EditableDetail label="Accountable Officer" field="accountableOfficer" value={asset.accountableOfficer} editValue={editForm.accountableOfficer} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          <EditableDetail label="Division" field="division" value={asset.division} editValue={editForm.division} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          <EditableDetail label="Office / Section" field="officeOrSection" value={asset.officeOrSection} editValue={editForm.officeOrSection} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          <EditableDetail label="Location" field="officeLocation" value={asset.officeLocation} editValue={editForm.officeLocation} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          <EditableDetail label="Condition" field="condition" value={asset.condition ? optionLabel(asset.condition) : asset.condition} editValue={editForm.condition}
            edit={edit && !['unserviceable', 'for_disposal'].includes(asset.condition) && !['flagged_for_disposal', 'disposed'].includes(asset.status)}
            onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} options={['serviceable', 'for_repair']} />
          <EditableDetail label="Components" field="components" value={asset.components} editValue={editForm.components} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          {asset.status === 'issued' && asset.expectedReturnDate && (
            <Detail label="Expected Return" value={new Date(asset.expectedReturnDate).toLocaleDateString()} />
          )}
        </DetailSection>

        <DetailSection title="Acquisition">
          <EditableDetail label="Cost (PHP)" field="acquisitionCost" value={asset.acquisitionCost ? `₱ ${Number(asset.acquisitionCost).toLocaleString()}` : null} editValue={editForm.acquisitionCost} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v === '' ? undefined : Number(v) }))} type="number" />
          <EditableDetail label="Acquisition Date" field="acquisitionDate" value={asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString() : null} editValue={editForm.acquisitionDate?.slice(0, 10)} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} type="date" />
          <EditableDetail label="Supplier" field="supplier" value={asset.supplier} editValue={editForm.supplier} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          <EditableDetail label="Date of Delivery" field="dateOfDelivery" value={asset.dateOfDelivery ? new Date(asset.dateOfDelivery).toLocaleDateString() : null} editValue={editForm.dateOfDelivery?.slice(0, 10)} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} type="date" />
          {asset.assetClass === 'IES' && (
            <>
              <EditableDetail label="Quantity on Hand" field="quantity" value={asset.quantity} editValue={editForm.quantity} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v === '' ? undefined : Number(v) }))} type="number" />
              <EditableDetail label="Reorder Level" field="reorderLevel" value={asset.reorderLevel} editValue={editForm.reorderLevel} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v === '' ? undefined : Number(v) }))} type="number" />
            </>
          )}
        </DetailSection>

        <DetailSection title="System">
          <Detail label="Asset ID" value={asset.id} />
          <Detail label="Custodian ID" value={asset.custodianId ? `···${asset.custodianId.slice(-8)}` : null} />
          <Detail label="Barcode" value={asset.barcodeValue} />
          <Detail label="Registered" value={new Date(asset.createdAt).toLocaleDateString()} />
          <Detail label="Last Updated" value={new Date(asset.updatedAt).toLocaleDateString()} />
        </DetailSection>
      </div>

      {/* Transaction History */}
      <div className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">Transaction History</h2>
        </div>
        {historyLoading ? (
          <div className="p-6"><LoadingSkeleton rows={4} /></div>
        ) : transactions.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">No lifecycle history recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Date / Time', 'Action', 'Performed By', 'Notes'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                        {tx.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-500">
                      {tx.userId ? `···${tx.userId.slice(-8)}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {(tx.metadata as Record<string, string> | null)?.notes ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showLifecycle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Update Lifecycle</h3>

            <div className="space-y-4">
              {/* Status selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  New Status
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => { setTargetStatus(e.target.value); setLifecycleError(''); setLifecycleEmployeeId(''); setLifecycleToLocation(''); setLifecycleExpectedReturnDate(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a]"
                >
                  <option value="">— select status —</option>
                  {nextStates.map((s) => (
                    <option key={s} value={s}>{s === 'flagged_for_disposal' ? 'Mark Unserviceable' : optionLabel(s)}</option>
                  ))}
                </select>
              </div>

              {/* ISSUED: Employee ID input */}
              {targetStatus === 'issued' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Recipient Employee ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CICC-0042"
                    value={lifecycleEmployeeId}
                    onChange={(e) => setLifecycleEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a]"
                  />
                  <p className="text-xs text-gray-400 mt-1">Enter the recipient&apos;s CICC employee ID. The system will resolve it to the correct user account.</p>
                </div>
              )}

              {/* ISSUED: optional expected return date — arms the overdue-return watcher */}
              {targetStatus === 'issued' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Expected return date (optional)
                  </label>
                  <input
                    type="date"
                    value={lifecycleExpectedReturnDate}
                    onChange={(e) => setLifecycleExpectedReturnDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a]"
                  />
                </div>
              )}

              {/* TRANSFERRED: To Location input */}
              {targetStatus === 'transferred' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Receiving Office / Section <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cybercrime Operations Division"
                    value={lifecycleToLocation}
                    onChange={(e) => setLifecycleToLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a]"
                  />
                </div>
              )}

              {/* Notes field — required for FLAGGED_FOR_DISPOSAL, optional for others */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  {targetStatus === 'flagged_for_disposal' ? 'Assessment reason (required)' : 'Notes'}
                </label>
                <textarea
                  rows={3}
                  value={lifecycleNotes}
                  onChange={(e) => setLifecycleNotes(e.target.value)}
                  placeholder={
                    targetStatus === 'flagged_for_disposal'
                      ? 'Describe why the asset is unserviceable.'
                      : targetStatus === 'under_repair'
                      ? 'Optional: describe the issue or defect'
                      : 'Optional notes'
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] resize-none"
                />
                {targetStatus === 'flagged_for_disposal' && (
                  <p className="mt-1 text-xs text-gray-500">This sets the condition to Unserviceable and sends the asset to Disposal Recommendations.</p>
                )}
              </div>

              {lifecycleError && (
                <p className="text-red-600 text-sm">{lifecycleError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button"
                onClick={handleLifecycleUpdate}
                disabled={
                  updating ||
                  !targetStatus ||
                  (targetStatus === 'issued' && !lifecycleEmployeeId.trim()) ||
                  (targetStatus === 'transferred' && !lifecycleToLocation.trim()) ||
                  (targetStatus === 'flagged_for_disposal' && !lifecycleNotes.trim())
                }
                className="flex-1 px-4 py-2 bg-[#1a4d7a] text-white rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-50 transition-colors"
              >
                {updating ? 'Updating...' : 'Confirm'}
              </button>
              <button type="button"
                onClick={() => { setShowLifecycle(false); setLifecycleError(''); setTargetStatus(''); setLifecycleNotes(''); setLifecycleEmployeeId(''); setLifecycleToLocation(''); setLifecycleExpectedReturnDate(''); }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
