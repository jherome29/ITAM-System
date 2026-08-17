'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileSpreadsheet, Download, Clock, RefreshCw } from 'lucide-react';
import { reportsApi, type GenerateFormDto, type FormMeta } from '@/lib/api/reports';
import { PageHeader } from '@/components/ui/PageHeader';

// ── Form type configuration ─────────────────────────────────────────────────

type InputGroup = 'asset' | 'requisition' | 'batch';

interface FormConfig {
  value: string;
  label: string;
  desc: string;
  group: InputGroup;
  /** Extra fields beyond the base group inputs */
  extras?: ('targetOffice' | 'circumstances' | 'lossType' | 'purpose' | 'requestingDivision' | 'returneeId')[];
}

const FORM_CONFIGS: FormConfig[] = [
  // Asset forms
  { value: 'PAR',    label: 'Appendix 71 — PAR',   desc: 'Property Acknowledgment Receipt',                  group: 'asset' },
  { value: 'ICS',    label: 'Appendix 59 — ICS',   desc: 'Inventory Custodian Slip',                         group: 'asset' },
  { value: 'PTR',    label: 'Appendix 76 — PTR',   desc: 'Property Transfer Report',                         group: 'asset', extras: ['targetOffice'] },
  { value: 'IIRUP',  label: 'Appendix 74 — IIRUP', desc: 'Inventory and Inspection Report of Unserviceable Property', group: 'asset' },
  { value: 'RLSDDP', label: 'Appendix 75 — RLSDDP', desc: 'Report of Lost, Stolen, Damaged or Destroyed Property', group: 'asset', extras: ['lossType', 'circumstances'] },
  { value: 'STICKER_CARD', label: 'Appendix 58 — Sticker Card', desc: 'Asset Property Label/Tag',            group: 'asset' },
  { value: 'RECEIPT_RETURNED_PROPERTY', label: 'Annex 28 — Receipt of Returned Property', desc: 'Receipt of Returned Property/Equipment', group: 'asset', extras: ['returneeId'] },
  { value: 'RECEIPT_RETURNED_SEP', label: 'Annex A.6 — Receipt of Returned SEP', desc: 'Receipt of Returned Semi-Expendable Property', group: 'asset', extras: ['returneeId'] },
  { value: 'IAR',    label: 'Appendix 62 — IAR',   desc: 'Inspection and Acceptance Report',                 group: 'asset' },
  { value: 'MOVE_IN', label: 'SS-01 — Move-In',    desc: 'Move-In Instructions',                             group: 'asset', extras: ['requestingDivision'] },
  { value: 'MOVE_OUT', label: 'SS-02 — Move-Out',  desc: 'Move-Out Form',                                    group: 'asset', extras: ['requestingDivision', 'purpose'] },
  // Requisition form
  { value: 'RIS',    label: 'RIS — Requisition and Issue Slip', desc: 'Requisition and Issue Slip',           group: 'requisition' },
  // Batch/period forms
  { value: 'RSMI',   label: 'Appendix 64 — RSMI',  desc: 'Report of Supplies and Materials Issued',          group: 'batch' },
  { value: 'RSPI',   label: 'Annex A.7 — RSPI',    desc: 'Report of Semi-Expendable Property Issued',        group: 'batch' },
  { value: 'RPCI',   label: 'Appendix 66 — RPCI',  desc: 'Report on Physical Count of Inventories',          group: 'batch' },
  { value: 'RPCPPE', label: 'Appendix 73 — RPCPPE', desc: 'Report on Physical Count of PPE',                 group: 'batch' },
  { value: 'WMR',    label: 'Appendix 65 — WMR',   desc: 'Waste Materials Report',                           group: 'batch' },
  { value: 'ANNEX_A4', label: 'Annex A.4 — SEP Registry', desc: 'Registry of Semi-Expendable Property Issued', group: 'batch' },
];

const GROUP_LABELS: Record<InputGroup, string> = {
  asset: 'Asset-Based Forms',
  requisition: 'Requisition-Based Forms',
  batch: 'Batch / Period Reports',
};

const LOSS_TYPES = ['Lost', 'Stolen', 'Damaged', 'Destroyed'] as const;

// ── Component ───────────────────────────────────────────────────────────────

export default function FormsPage() {
  const [selectedForm, setSelectedForm] = useState('');
  const [assetId, setAssetId] = useState('');
  const [requisitionId, setRequisitionId] = useState('');
  const [targetOffice, setTargetOffice] = useState('');
  const [circumstances, setCircumstances] = useState('');
  const [lossType, setLossType] = useState<string>('Damaged');
  const [purpose, setPurpose] = useState('');
  const [requestingDivision, setRequestingDivision] = useState('');
  const [returneeId, setReturneeId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Previously generated forms history
  const [history, setHistory] = useState<FormMeta[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchHistory = useCallback(() => {
    reportsApi
      .forms(1, 20)
      .then((r) => setHistory(r.data.data))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefreshHistory = () => {
    setHistoryLoading(true);
    fetchHistory();
  };

  const config = FORM_CONFIGS.find((f) => f.value === selectedForm);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForm) return;
    setLoading(true);
    setError('');

    try {
      const dto: GenerateFormDto = { formType: selectedForm };
      if (config?.group === 'asset' && assetId.trim()) dto.assetId = assetId.trim();
      if (config?.group === 'requisition' && requisitionId.trim()) dto.requisitionId = requisitionId.trim();
      if (config?.group === 'batch') {
        if (dateFrom) dto.dateFrom = dateFrom;
        if (dateTo) dto.dateTo = dateTo;
      }
      if (config?.extras?.includes('targetOffice') && targetOffice.trim()) dto.targetOffice = targetOffice.trim();
      if (config?.extras?.includes('circumstances') && circumstances.trim()) dto.circumstances = circumstances.trim();
      if (config?.extras?.includes('lossType')) dto.lossType = lossType as GenerateFormDto['lossType'];
      if (config?.extras?.includes('purpose') && purpose.trim()) dto.purpose = purpose.trim();
      if (config?.extras?.includes('requestingDivision') && requestingDivision.trim()) dto.requestingDivision = requestingDivision.trim();
      if (config?.extras?.includes('returneeId') && returneeId.trim()) dto.returneeId = returneeId.trim();

      const blob = await reportsApi.generateFormBlob(dto);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // eslint-disable-next-line react-hooks/purity -- Date.now() is in an async event handler, not in render
      a.download = `${selectedForm}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setHistoryLoading(true);
      fetchHistory();
    } catch {
      setError('Failed to generate form. Verify the ID exists and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRedownload = async (form: FormMeta) => {
    setDownloadingId(form.id);
    try {
      const blob = await reportsApi.downloadStoredForm(form.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form.formType}-${form.generatedAt.slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — old records before this feature won't have a stored PDF
    } finally {
      setDownloadingId(null);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors';

  const groups: InputGroup[] = ['asset', 'requisition', 'batch'];

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Generate Official Forms" />

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">COA / CICC Official Forms</h2>
        </div>

        <form onSubmit={handleGenerate} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
          )}

          {/* Form type selector, grouped */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Form Type</label>
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{GROUP_LABELS[group]}</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {FORM_CONFIGS.filter((f) => f.group === group).map((f) => (
                      <label
                        key={f.value}
                        className={`flex items-start gap-3 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                          selectedForm === f.value ? 'border-[#1a4d7a] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="formType"
                          value={f.value}
                          checked={selectedForm === f.value}
                          onChange={() => setSelectedForm(f.value)}
                          className="mt-0.5 shrink-0"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{f.label}</p>
                          <p className="text-xs text-gray-500">{f.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Context-aware input fields */}
          {config && (
            <div className="space-y-3 pt-2 border-t border-gray-100">

              {/* Asset ID field */}
              {config.group === 'asset' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asset UUID</label>
                  <input
                    type="text"
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
                    className={inputClass}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Copy from the Asset Details page URL or table.</p>
                </div>
              )}

              {/* Requisition ID field */}
              {config.group === 'requisition' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Requisition UUID</label>
                  <input
                    type="text"
                    value={requisitionId}
                    onChange={(e) => setRequisitionId(e.target.value)}
                    placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
                    className={inputClass}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Copy from the Fulfillment Queue or requisition detail page.</p>
                </div>
              )}

              {/* Date range for batch forms */}
              {config.group === 'batch' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
                  </div>
                  <p className="col-span-2 text-xs text-gray-400">Leave blank to use the current calendar year to today.</p>
                </div>
              )}

              {/* Extra fields */}
              {config.extras?.includes('targetOffice') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Receiving Office / Section</label>
                  <input type="text" value={targetOffice} onChange={(e) => setTargetOffice(e.target.value)} placeholder="e.g. Anti-Cybercrime Division — NCR" className={inputClass} required />
                </div>
              )}

              {config.extras?.includes('lossType') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type of Loss/Damage</label>
                  <select value={lossType} onChange={(e) => setLossType(e.target.value)} className={inputClass}>
                    {LOSS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {config.extras?.includes('circumstances') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Circumstances / Description</label>
                  <textarea value={circumstances} onChange={(e) => setCircumstances(e.target.value)} placeholder="Describe the circumstances of the loss or damage..." rows={3} className={inputClass} />
                </div>
              )}

              {config.extras?.includes('requestingDivision') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Requesting Division</label>
                  <input type="text" value={requestingDivision} onChange={(e) => setRequestingDivision(e.target.value)} placeholder="e.g. Information Technology Division" className={inputClass} required />
                </div>
              )}

              {config.extras?.includes('purpose') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purpose of Move-Out</label>
                  <input type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. For repair / Training use / Return to supply" className={inputClass} />
                </div>
              )}

              {config.extras?.includes('returneeId') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Returnee User UUID <span className="text-gray-400 font-normal">(optional — defaults to current custodian)</span></label>
                  <input type="text" value={returneeId} onChange={(e) => setReturneeId(e.target.value)} placeholder="Leave blank to use asset's current custodian" className={inputClass} />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !selectedForm}
              className="flex items-center gap-2 bg-[#1a4d7a] text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-60 transition-colors"
            >
              <Download className="w-4 h-4" />
              {loading ? 'Generating PDF…' : 'Generate & Download'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs text-blue-700 font-medium">COA Compliance Note</p>
        <p className="text-xs text-blue-600 mt-1">
          Generated PDFs contain text-only signature lines. Forms requiring physical signatures must be printed, signed manually, and the original retained. The digital copy stored in AIMRS serves as the audit reference.
        </p>
      </div>

      {/* Previously generated forms */}
      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#1a4d7a]" />
            <h2 className="text-base font-semibold text-[#1a4d7a]">Previously Generated Forms</h2>
          </div>
          <button type="button"
            onClick={handleRefreshHistory}
            className="flex items-center gap-1.5 text-xs text-[#1a4d7a] hover:text-[#143d61] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {historyLoading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading history…</div>
        ) : history.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No forms generated yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((form) => (
              <div key={form.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-800">{form.formType}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(form.generatedAt).toLocaleString('en-PH', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {form.relatedAssetId && (
                      <span className="ml-2 text-gray-300">· asset {form.relatedAssetId.slice(0, 8)}…</span>
                    )}
                    {form.relatedRequisitionId && (
                      <span className="ml-2 text-gray-300">· req {form.relatedRequisitionId.slice(0, 8)}…</span>
                    )}
                  </p>
                </div>
                <button type="button"
                  onClick={() => handleRedownload(form)}
                  disabled={downloadingId === form.id || form.filePath !== 'stored'}
                  title={form.filePath !== 'stored' ? 'PDF not stored — regenerate from the form above' : 'Download stored PDF'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#1a4d7a] border border-[#1a4d7a]/30 rounded-md hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingId === form.id ? 'Downloading…' : 'Download'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
