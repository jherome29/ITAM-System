'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, QrCode, Pencil, Save, X } from 'lucide-react';
import { assetsApi, type Asset, type UpdateAssetDto } from '@/lib/api/assets';
import { auditApi, type AuditLog } from '@/lib/api/audit';
import { OUTCOME_LABEL, SERVICE_TYPE_LABEL, repairsApi, type Repair } from '@/lib/api/repairs';
import { formatDate } from '@/lib/requisitions/requisition-view';
import { historyEntries, lastTransfer } from '@/lib/assets/asset-history';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ASSET_LIFECYCLE_TRANSITIONS as NEXT_TRANSITIONS, lifecycleNotesRequired } from '@/lib/assets/lifecycle-transitions';
import { formatDateTime, formatPeso } from '@/lib/dates';
import { tdClass, tdWrapClass, thClass } from '@/components/admin/AdminUi';
import { buttonClass } from '@/components/ui/buttons';
import { controlClass, labelClass, surfaceClass, textareaClass } from '@/components/ui/controls';
import { DateField } from '@/components/ui/DateField';
import { PageHeader } from '@/components/ui/PageHeader';
import { Chip } from '@/components/ui/Chip';
import { EmptyMessage } from '@/components/ui/EmptyRow';
import { CenteredModal } from '@/components/ui/CenteredModal';
import { Panel } from '@/components/ui/Panel';

function optionLabel(value: string): string {
  return value.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function Detail({ label, value }: Readonly<{ label: string; value?: string | number | null }>) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{label}</dt>
      <dd className={`text-sm ${value ? 'text-slate-800' : 'text-slate-500 italic'}`}>{value ?? 'Not specified'}</dd>
    </div>
  );
}

function DetailSection({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className={`${surfaceClass} p-5`}>
      <h3 className="text-xs font-bold text-brand uppercase tracking-wider mb-4">{title}</h3>
      <dl className="grid grid-cols-2 gap-4">{children}</dl>
    </div>
  );
}

function EditableDetail({
  label,
  field,
  value,
  editValue,
  edit,
  onChange,
  inputType = 'text',
  options,
}: Readonly<{
  label: string;
  field: string;
  value?: string | number | null;
  editValue?: string | number;
  edit: boolean;
  onChange: (field: string, val: string) => void;
  inputType?: string;
  options?: string[];
}>) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{label}</dt>
      {edit ? (
        options ? (
          <select aria-label={label} value={editValue ?? ''} onChange={(e) => onChange(field, e.target.value)} className={controlClass}>
            <option value="">— select —</option>
            {options.map((o) => <option key={o} value={o}>{optionLabel(o)}</option>)}
          </select>
        ) : (
          inputType === 'date' ? (
            <DateField aria-label={label} value={editValue ?? ''} onChange={(e) => onChange(field, e.target.value)} />
          ) : (
            <input
              aria-label={label}
              type={inputType}
              value={editValue ?? ''}
              onChange={(e) => onChange(field, e.target.value)}
              className={controlClass}
            />
          )
        )
      ) : (
        <dd className={`text-sm ${value ? 'text-slate-800' : 'text-slate-500 italic'}`}>{value ?? 'Not specified'}</dd>
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- basePath is part of the shared component's public interface (parity with AssetRegistryList/RegisterAssetForm); this component doesn't build any internal links off it today.
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
  // Arrival of a transferred asset: where it now sits, so the registry matches.
  const [lifecycleOffice, setLifecycleOffice] = useState('');
  const [lifecycleRoom, setLifecycleRoom] = useState('');

  const [edit, setEdit] = useState(false);
  const [editForm, setEditForm] = useState<UpdateAssetDto>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [transactions, setTransactions] = useState<AuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [formSuggestion, setFormSuggestion] = useState<string | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const loadRepairs = useCallback(
    () => repairsApi.forAsset(assetId).then((res) => setRepairs(res.data)).catch(() => {}),
    [assetId],
  );

  useEffect(() => {
    Promise.all([
      assetsApi.getOne(assetId).then((res) => {
        setAsset(res.data);
        setEditForm(buildEditForm(res.data));
      }),
      auditApi.byRecord(assetId).then((res) => setTransactions(res.data ?? [])).catch(() => {}),
      loadRepairs(),
    ])
      .catch(() => {})
      .finally(() => { setLoading(false); setHistoryLoading(false); });
  }, [assetId, loadRepairs]);

  const handleGenerateQr = async () => {
    if (!asset) return;
    try {
      const res = await assetsApi.generateQr(asset.id);
      setAsset((prev) => prev ? { ...prev, qrCode: res.data.qrCode } : prev);
    } catch {
      setSaveError('Could not generate QR code. Please try again.');
    }
  };

  const handleLifecycleUpdate = async () => {
    const statusSnapshot = targetStatus;
    if (!asset || !statusSnapshot) return;
    const arriving = asset.status === 'transferred' && statusSnapshot === 'available';
    setUpdating(true);
    setLifecycleError('');
    try {
      const res = await assetsApi.updateLifecycle(asset.id, {
        status: statusSnapshot,
        notes: lifecycleNotes || undefined,
        employeeId: lifecycleEmployeeId || undefined,
        toLocation: lifecycleToLocation || undefined,
        expectedReturnDate: lifecycleExpectedReturnDate || undefined,
        // Only an arrival (transferred → available) takes a new office/location.
        officeOrSection: arriving ? lifecycleOffice.trim() || undefined : undefined,
        officeLocation: arriving ? lifecycleRoom.trim() || undefined : undefined,
      });
      setAsset(res.data);
      setShowLifecycle(false);
      setTargetStatus('');
      setLifecycleNotes('');
      setLifecycleEmployeeId('');
      setLifecycleToLocation('');
      setLifecycleExpectedReturnDate('');
      setLifecycleOffice('');
      setLifecycleRoom('');
      // Refresh audit and repair history after lifecycle change
      auditApi.byRecord(assetId).then((r) => setTransactions(r.data ?? [])).catch(() => {});
      void loadRepairs();
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
      const res = await assetsApi.update(asset.id, editForm);
      setAsset(res.data);
      setEdit(false);
      auditApi.byRecord(assetId).then((r) => setTransactions(r.data ?? [])).catch(() => {});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSaveError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Could not save.'));
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

  if (loading) return <div className="p-6"><LoadingSkeleton rows={10} /></div>;
  if (!asset) return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">Asset not found.</div>;

  // From under repair, 'issued' only hands the item back to its holder — it is
  // offered only when there is one, and needs no recipient ID.
  const handBack = asset.status === 'under_repair' && Boolean(asset.custodianId);
  const nextStates = (NEXT_TRANSITIONS[asset.status] ?? []).filter((s) => s !== 'issued' || asset.status !== 'under_repair' || handBack);
  const notesRequired = lifecycleNotesRequired(asset.status, targetStatus);
  const restoring = asset.status === 'flagged_for_disposal' && targetStatus === 'available';
  const stateLabel = (s: string) => (handBack && s === 'issued' ? 'Repaired — return to holder' : optionLabel(s));
  // While transferred the registry still shows the place it left; say where it went.
  const transfer = asset.status === 'transferred' ? lastTransfer(asset.locationHistory) : null;
  const history = historyEntries(transactions);

  const closeLifecycle = () => {
    setShowLifecycle(false);
    setLifecycleError('');
    setTargetStatus('');
    setLifecycleNotes('');
    setLifecycleEmployeeId('');
    setLifecycleToLocation('');
    setLifecycleExpectedReturnDate('');
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <button type="button" onClick={() => router.back()} className="flex items-center gap-2 text-sm font-semibold text-brand hover:underline">
        <ArrowLeft className="h-5 w-5" /> Back to Inventory
      </button>

      <PageHeader
        title={asset.itemDescription}
        badge={<StatusBadge status={asset.status} />}
        detail={asset.propertyNumber ? `Property #: ${asset.propertyNumber}` : undefined}
        action={
        <div className="flex flex-wrap gap-2">
          {edit ? (
            <>
              <button type="button"
                onClick={handleSave}
                disabled={saving}
                className={buttonClass()}
              >
                <Save className="h-5 w-5" /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button"
                onClick={handleCancelEdit}
                className={buttonClass({ variant: 'secondary' })}
              >
                <X className="h-5 w-5" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button"
                onClick={() => setEdit(true)}
                className={buttonClass({ variant: 'secondary' })}
              >
                <Pencil className="h-5 w-5" /> Edit
              </button>
              {!asset.qrCode && (
                <button type="button"
                  onClick={handleGenerateQr}
                  className={buttonClass({ variant: 'secondary' })}
                >
                  <QrCode className="h-5 w-5" /> Generate QR
                </button>
              )}
              {nextStates.length > 0 && (
                <button type="button"
                  onClick={() => setShowLifecycle(true)}
                  className={buttonClass()}
                >
                  Update Lifecycle
                </button>
              )}
            </>
          )}
        </div>
        }
      />

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

      {transfer && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Transferred to {transfer.to}</strong> on {formatDate(transfer.at)}. The location below is where it came from. When it arrives, choose <em>Update Lifecycle → Available</em> and confirm its new office and location.
        </div>
      )}

      {formSuggestion && (
        <div className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-md px-4 py-3">
          <span>
            Lifecycle updated. Consider generating a <strong>{formSuggestion}</strong> form for this transaction.
          </span>
          <div className="flex gap-2 shrink-0">
            <button type="button"
              onClick={() => router.push(formsPath)}
              className={buttonClass({ size: 'sm' })}
            >
              Go to Forms
            </button>
            <button type="button"
              onClick={() => setFormSuggestion(null)}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailSection title="Classification">
          <EditableDetail label="SAP Classification" field="sapClassification" value={asset.sapClassification} editValue={editForm.sapClassification} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          <EditableDetail label="Item Code" field="itemCode" value={asset.itemCode} editValue={editForm.itemCode} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
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
          <EditableDetail label="Condition" field="condition" value={asset.condition ? optionLabel(asset.condition) : asset.condition} editValue={editForm.condition} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} options={['serviceable', 'unserviceable', 'for_repair', 'for_disposal']} />
          <EditableDetail label="Components" field="components" value={asset.components} editValue={editForm.components} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          {asset.status === 'issued' && asset.expectedReturnDate && (
            <Detail label="Expected Return" value={formatDate(asset.expectedReturnDate)} />
          )}
        </DetailSection>

        <DetailSection title="Acquisition">
          <EditableDetail label="Cost (PHP)" field="acquisitionCost" value={asset.acquisitionCost ? formatPeso(asset.acquisitionCost) : null} editValue={editForm.acquisitionCost} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v === '' ? undefined : Number(v) }))} inputType="number" />
          <EditableDetail label="Acquisition Date" field="acquisitionDate" value={asset.acquisitionDate ? formatDate(asset.acquisitionDate) : null} editValue={editForm.acquisitionDate?.slice(0, 10)} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} inputType="date" />
          <EditableDetail label="Supplier" field="supplier" value={asset.supplier} editValue={editForm.supplier} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          <EditableDetail label="Date of Delivery" field="dateOfDelivery" value={asset.dateOfDelivery ? formatDate(asset.dateOfDelivery) : null} editValue={editForm.dateOfDelivery?.slice(0, 10)} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} inputType="date" />
          {asset.assetClass === 'IES' && (
            <>
              <EditableDetail label="Quantity on Hand" field="quantity" value={asset.quantity} editValue={editForm.quantity} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v === '' ? undefined : Number(v) }))} inputType="number" />
              <EditableDetail label="Reorder Level" field="reorderLevel" value={asset.reorderLevel} editValue={editForm.reorderLevel} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v === '' ? undefined : Number(v) }))} inputType="number" />
            </>
          )}
        </DetailSection>

        <DetailSection title="System">
          <Detail label="Asset ID" value={asset.id} />
          <Detail label="Custodian ID" value={asset.custodianId ? `···${asset.custodianId.slice(-8)}` : null} />
          <Detail label="Barcode" value={asset.barcodeValue} />
          <Detail label="Registered" value={formatDate(asset.createdAt)} />
          <Detail label="Last Updated" value={formatDate(asset.updatedAt)} />
        </DetailSection>
      </div>

      {/* Repair History — one row per stay under repair */}
      {repairs.length > 0 && (
        <Panel title="Repair History" detail={`${repairs.length} repair${repairs.length === 1 ? '' : 's'} — managed in Maintenance & Repair`}>
          <ul className="divide-y divide-slate-100">
            {repairs.map((r) => (
              <li key={r.id} className="p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">
                    {formatDate(r.openedAt)} → {r.completedAt ? formatDate(r.completedAt) : `due ${formatDate(r.dueDate)}`}
                    <span className="ml-2 font-normal text-slate-500">{SERVICE_TYPE_LABEL[r.serviceType]}{r.serviceProvider ? ` · ${r.serviceProvider}` : ''}{r.holder ? ` · held by ${r.holder.name}` : ''}</span>
                  </p>
                  <Chip tone={r.outcome === 'repaired' ? 'green' : r.outcome ? 'slate' : r.overdue ? 'red' : 'amber'}>
                    {r.outcome ? OUTCOME_LABEL[r.outcome] : r.overdue ? 'Overdue' : 'Under repair'}
                  </Chip>
                </div>
                {r.reportedProblem && <p className="mt-1 text-slate-600"><span className="font-semibold">Problem:</span> {r.reportedProblem}</p>}
                {r.findings && <p className="mt-0.5 text-slate-600"><span className="font-semibold">Findings:</span> {r.findings}</p>}
                {r.actionTaken && <p className="mt-0.5 text-slate-600"><span className="font-semibold">Work done:</span> {r.actionTaken}</p>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Transaction History */}
      <Panel title="Transaction History">
        {historyLoading ? (
          <div className="p-6"><LoadingSkeleton rows={4} /></div>
        ) : history.length === 0 ? (
          <EmptyMessage>No lifecycle history recorded yet.</EmptyMessage>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Date / Time', 'Event', 'By', 'Details'].map((h) => (
                    <th key={h} className={thClass}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="align-top hover:bg-blue-50 transition-colors">
                    <td className={tdClass}>
                      {formatDateTime(entry.when)}
                    </td>
                    <td className={tdClass}>
                      <Chip tone="blue">{entry.event}</Chip>
                    </td>
                    <td className={tdClass}>{entry.by}</td>
                    <td className={tdWrapClass}>
                      {entry.details.length === 0 ? '—' : entry.details.map((line) => <p key={line}>{line}</p>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <CenteredModal open={showLifecycle} title="Update Lifecycle" size="sm" onClose={closeLifecycle}>
            <div className="space-y-4">
              {/* Status selector */}
              <div>
                <label htmlFor="asset-field-1" className={labelClass}>
                  New Status
                </label>
                <select id="asset-field-1"
                  value={targetStatus}
                  onChange={(e) => {
                    setTargetStatus(e.target.value);
                    setLifecycleError('');
                    setLifecycleEmployeeId('');
                    setLifecycleToLocation('');
                    setLifecycleExpectedReturnDate('');
                    // Arrival: suggest the office it was sent to; the custodian confirms or corrects it.
                    setLifecycleOffice(asset.status === 'transferred' && e.target.value === 'available' ? (transfer?.to ?? '') : '');
                    setLifecycleRoom('');
                  }}
                  className={controlClass}
                >
                  <option value="">— select status —</option>
                  {nextStates.map((s) => (
                    <option key={s} value={s}>{stateLabel(s)}</option>
                  ))}
                </select>
              </div>

              {targetStatus === 'issued' && handBack && (
                <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900">The repaired item goes back to its current holder, who is notified to collect it. To give it to someone else, make it Available first.</p>
              )}

              {/* ISSUED: Employee ID input */}
              {targetStatus === 'issued' && !handBack && (
                <div>
                  <label htmlFor="asset-field-2" className={labelClass}>
                    Recipient Employee ID <span className="text-red-500">*</span>
                  </label>
                  <input id="asset-field-2"
                    type="text"
                    placeholder="e.g. CICC-0042"
                    value={lifecycleEmployeeId}
                    onChange={(e) => setLifecycleEmployeeId(e.target.value)}
                    className={controlClass}
                  />
                  <p className="text-xs text-slate-500 mt-1">Enter the recipient&apos;s CICC employee ID. The system will resolve it to the correct user account.</p>
                </div>
              )}

              {/* ISSUED: optional expected return date — arms the overdue-return watcher */}
              {targetStatus === 'issued' && (
                <div>
                  <label htmlFor="asset-field-3" className={labelClass}>
                    Expected return date (optional)
                  </label>
                  <DateField id="asset-field-3"
                    value={lifecycleExpectedReturnDate}
                    onChange={(e) => setLifecycleExpectedReturnDate(e.target.value)}
                  />
                </div>
              )}

              {/* TRANSFERRED: To Location input */}
              {targetStatus === 'transferred' && (
                <div>
                  <label htmlFor="asset-field-4" className={labelClass}>
                    Receiving Office / Section <span className="text-red-500">*</span>
                  </label>
                  <input id="asset-field-4"
                    type="text"
                    placeholder="e.g. Cybercrime Operations Division"
                    value={lifecycleToLocation}
                    onChange={(e) => setLifecycleToLocation(e.target.value)}
                    className={controlClass}
                  />
                </div>
              )}

              {/* ARRIVAL (transferred → available): where it now sits, so the registry matches reality */}
              {asset.status === 'transferred' && targetStatus === 'available' && (
                <>
                  <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900">
                    The asset has arrived. Confirm where it now sits and the registry will show it there. Leave a field blank to keep what the registry has today.
                  </p>
                  <div>
                    <label htmlFor="arrival-office" className={labelClass}>
                      Office / Section
                    </label>
                    <input
                      id="arrival-office"
                      type="text"
                      placeholder={asset.officeOrSection || 'e.g. Cyber Intelligence Unit'}
                      value={lifecycleOffice}
                      onChange={(e) => setLifecycleOffice(e.target.value)}
                      className={controlClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="arrival-room" className={labelClass}>
                      Location (room / floor)
                    </label>
                    <input
                      id="arrival-room"
                      type="text"
                      placeholder={asset.officeLocation || 'e.g. Intelligence Room, 4th Floor'}
                      value={lifecycleRoom}
                      onChange={(e) => setLifecycleRoom(e.target.value)}
                      className={controlClass}
                    />
                  </div>
                </>
              )}

              {/* Notes field — required for FLAGGED_FOR_DISPOSAL, optional for others */}
              <div>
                <label htmlFor="asset-field-5" className={labelClass}>
                  Notes {notesRequired && <span className="text-red-500">* (required — {restoring ? 'say why it is being restored' : 'justify disposal'})</span>}
                </label>
                <textarea id="asset-field-5"
                  rows={3}
                  value={lifecycleNotes}
                  onChange={(e) => setLifecycleNotes(e.target.value)}
                  placeholder={
                    restoring
                      ? 'Required: why is this asset being restored to stock? (e.g. found, flagged in error) and its condition'
                      : targetStatus === 'flagged_for_disposal'
                      ? 'Required: describe condition, reason for disposal, and recommended action'
                      : targetStatus === 'under_repair'
                      ? 'Optional: describe the issue or defect'
                      : 'Optional notes'
                  }
                  className={`${textareaClass} resize-none`}
                />
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
                  (targetStatus === 'issued' && !handBack && !lifecycleEmployeeId.trim()) ||
                  (targetStatus === 'transferred' && !lifecycleToLocation.trim()) ||
                  (notesRequired && !lifecycleNotes.trim())
                }
                className={`${buttonClass()} flex-1`}
              >
                {updating ? 'Updating…' : 'Confirm'}
              </button>
              <button type="button"
                onClick={closeLifecycle}
                className={`${buttonClass({ variant: 'secondary' })} flex-1`}
              >
                Cancel
              </button>
            </div>
      </CenteredModal>
    </div>
  );
}
