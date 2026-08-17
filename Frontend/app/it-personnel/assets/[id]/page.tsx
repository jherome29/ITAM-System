'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, QrCode, Pencil, Save, X, Clock } from 'lucide-react';
import { assetsApi, type Asset, type UpdateAssetDto } from '@/lib/api/assets';
import { auditApi, type AuditLog } from '@/lib/api/audit';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

const NEXT_TRANSITIONS: Record<string, string[]> = {
  REGISTERED: ['AVAILABLE'],
  AVAILABLE: ['ISSUED', 'TRANSFERRED', 'UNDER_REPAIR', 'FLAGGED_FOR_DISPOSAL'],
  ISSUED: ['RETURNED', 'UNDER_REPAIR', 'FLAGGED_FOR_DISPOSAL'],
  RETURNED: ['AVAILABLE', 'UNDER_REPAIR'],
  TRANSFERRED: ['AVAILABLE'],
  UNDER_REPAIR: ['AVAILABLE', 'FLAGGED_FOR_DISPOSAL'],
  FLAGGED_FOR_DISPOSAL: ['DISPOSED'],
  DISPOSED: [],
};

function Detail({ label, value }: Readonly<{ label: string; value?: string | number | null }>) {
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</dt>
      <dd className={`text-sm ${value ? 'text-gray-800' : 'text-gray-300 italic'}`}>{value ?? 'Not specified'}</dd>
    </div>
  );
}

function DetailSection({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-xs font-bold text-[#1a4d7a] uppercase tracking-wider mb-4">{title}</h3>
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
    <div>
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</dt>
      {edit ? (
        options ? (
          <select value={editValue ?? ''} onChange={(e) => onChange(field, e.target.value)} className={cls}>
            <option value="">— select —</option>
            {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
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
        <dd className={`text-sm ${value ? 'text-gray-800' : 'text-gray-300 italic'}`}>{value ?? 'Not specified'}</dd>
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
  };
}

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLifecycle, setShowLifecycle] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [lifecycleNotes, setLifecycleNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [lifecycleError, setLifecycleError] = useState('');
  const [lifecycleEmployeeId, setLifecycleEmployeeId] = useState('');
  const [lifecycleToLocation, setLifecycleToLocation] = useState('');

  const [edit, setEdit] = useState(false);
  const [editForm, setEditForm] = useState<UpdateAssetDto>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [transactions, setTransactions] = useState<AuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [formSuggestion, setFormSuggestion] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      assetsApi.getOne(id).then((res) => {
        setAsset(res.data);
        setEditForm(buildEditForm(res.data));
      }),
      auditApi.byRecord(id).then((res) => setTransactions(res.data?.data ?? [])).catch(() => {}),
    ])
      .catch(() => {})
      .finally(() => { setLoading(false); setHistoryLoading(false); });
  }, [id]);

  const handleGenerateQr = async () => {
    if (!asset) return;
    try {
      const res = await assetsApi.generateQr(asset.id);
      setAsset((prev) => prev ? { ...prev, qrCode: res.data.qrCode } : prev);
    } catch {
      setSaveError('Failed to generate QR code. Please try again.');
    }
  };

  const handleLifecycleUpdate = async () => {
    const statusSnapshot = targetStatus;
    if (!asset || !statusSnapshot) return;
    setUpdating(true);
    setLifecycleError('');
    try {
      const res = await assetsApi.updateLifecycle(asset.id, {
        status: statusSnapshot,
        notes: lifecycleNotes || undefined,
        employeeId: lifecycleEmployeeId || undefined,
        toLocation: lifecycleToLocation || undefined,
      });
      setAsset(res.data);
      setShowLifecycle(false);
      setTargetStatus('');
      setLifecycleNotes('');
      setLifecycleEmployeeId('');
      setLifecycleToLocation('');
      // Refresh audit history after lifecycle change
      auditApi.byRecord(id).then((r) => setTransactions(r.data?.data ?? [])).catch(() => {});
      // Suggest relevant COA form
      const cls = res.data.assetClass;
      if (statusSnapshot === 'ISSUED') {
        setFormSuggestion(cls === 'PPE' ? 'PAR' : 'ICS');
      } else if (statusSnapshot === 'TRANSFERRED') {
        setFormSuggestion('PTR');
      } else if (statusSnapshot === 'FLAGGED_FOR_DISPOSAL') {
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
      auditApi.byRecord(id).then((r) => setTransactions(r.data?.data ?? [])).catch(() => {});
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

  if (loading) return <div className="p-6"><LoadingSkeleton rows={10} /></div>;
  if (!asset) return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">Asset not found.</div>;

  const nextStates = NEXT_TRANSITIONS[asset.status] ?? [];

  return (
    <div className="space-y-5 max-w-4xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#1a4d7a] hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to Inventory
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-[#1a4d7a]">{asset.itemDescription}</h1>
            <StatusBadge status={asset.status} />
          </div>
          {asset.propertyNumber && (
            <p className="text-sm text-gray-500 font-mono mt-1">Property #: {asset.propertyNumber}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {edit ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEdit(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              {!asset.qrCode && (
                <button
                  onClick={handleGenerateQr}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <QrCode className="w-4 h-4" /> Generate QR
                </button>
              )}
              {nextStates.length > 0 && (
                <button
                  onClick={() => setShowLifecycle(true)}
                  className="px-4 py-2 bg-[#1a4d7a] text-white rounded-md text-sm font-medium hover:bg-[#143d61] transition-colors"
                >
                  Update Lifecycle
                </button>
              )}
            </>
          )}
        </div>
      </div>

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
        <div className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-md px-4 py-3">
          <span>
            Lifecycle updated. Consider generating a <strong>{formSuggestion}</strong> form for this transaction.
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => router.push('/it-personnel/forms')}
              className="px-3 py-1 bg-[#1a4d7a] text-white rounded text-xs font-medium hover:bg-[#143d61] transition-colors"
            >
              Go to Forms
            </button>
            <button
              onClick={() => setFormSuggestion(null)}
              className="px-3 py-1 border border-blue-300 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 transition-colors"
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
          <EditableDetail label="Condition" field="condition" value={asset.condition?.replace(/_/g, ' ')} editValue={editForm.condition} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} options={['SERVICEABLE', 'UNSERVICEABLE', 'FOR_REPAIR', 'FOR_DISPOSAL']} />
          <EditableDetail label="Components" field="components" value={asset.components} editValue={editForm.components} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
        </DetailSection>

        <DetailSection title="Acquisition">
          <EditableDetail label="Cost (PHP)" field="acquisitionCost" value={asset.acquisitionCost ? `₱ ${Number(asset.acquisitionCost).toLocaleString()}` : null} editValue={editForm.acquisitionCost} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v === '' ? undefined : Number(v) }))} type="number" />
          <EditableDetail label="Acquisition Date" field="acquisitionDate" value={asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString() : null} editValue={editForm.acquisitionDate?.slice(0, 10)} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} type="date" />
          <EditableDetail label="Supplier" field="supplier" value={asset.supplier} editValue={editForm.supplier} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
          <EditableDetail label="Date of Delivery" field="dateOfDelivery" value={asset.dateOfDelivery ? new Date(asset.dateOfDelivery).toLocaleDateString() : null} editValue={editForm.dateOfDelivery?.slice(0, 10)} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} type="date" />
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
      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
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
                  onChange={(e) => { setTargetStatus(e.target.value); setLifecycleError(''); setLifecycleEmployeeId(''); setLifecycleToLocation(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a]"
                >
                  <option value="">— select status —</option>
                  {nextStates.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              {/* ISSUED: Employee ID input */}
              {targetStatus === 'ISSUED' && (
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

              {/* TRANSFERRED: To Location input */}
              {targetStatus === 'TRANSFERRED' && (
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
                  Notes {targetStatus === 'FLAGGED_FOR_DISPOSAL' && <span className="text-red-500">* (required — justify disposal)</span>}
                </label>
                <textarea
                  rows={3}
                  value={lifecycleNotes}
                  onChange={(e) => setLifecycleNotes(e.target.value)}
                  placeholder={
                    targetStatus === 'FLAGGED_FOR_DISPOSAL'
                      ? 'Required: describe condition, reason for disposal, and recommended action'
                      : targetStatus === 'UNDER_REPAIR'
                      ? 'Optional: describe the issue or defect'
                      : 'Optional notes'
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] resize-none"
                />
              </div>

              {lifecycleError && (
                <p className="text-red-600 text-sm">{lifecycleError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleLifecycleUpdate}
                disabled={
                  updating ||
                  !targetStatus ||
                  (targetStatus === 'ISSUED' && !lifecycleEmployeeId.trim()) ||
                  (targetStatus === 'TRANSFERRED' && !lifecycleToLocation.trim()) ||
                  (targetStatus === 'FLAGGED_FOR_DISPOSAL' && !lifecycleNotes.trim())
                }
                className="flex-1 px-4 py-2 bg-[#1a4d7a] text-white rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-50 transition-colors"
              >
                {updating ? 'Updating...' : 'Confirm'}
              </button>
              <button
                onClick={() => { setShowLifecycle(false); setLifecycleError(''); setTargetStatus(''); setLifecycleNotes(''); setLifecycleEmployeeId(''); setLifecycleToLocation(''); }}
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
