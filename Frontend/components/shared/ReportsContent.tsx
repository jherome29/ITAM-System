'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { AdminPageHeader, Panel, PrimaryButton } from '@/components/admin/AdminUi';
import { apiErrorMessage } from '@/lib/api/error-message';
import { reportsApi } from '@/lib/api/reports';
import { downloadBlob } from '@/lib/download';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';

const ALL_REPORT_TYPES = [
  { value: 'ASSET_MASTER_LIST', label: 'Asset Master List', detail: 'Every asset with its class, status, location and cost.', formats: ['pdf', 'excel'] as const },
  { value: 'REQUISITION_HISTORY', label: 'Requisition History Log', detail: 'Requisitions with their status, dates and items.', formats: ['pdf', 'excel'] as const },
  { value: 'ASSET_ISSUANCE', label: 'Asset Issuance Record', detail: 'Assets issued to personnel.', formats: ['pdf'] as const },
  { value: 'ASSET_RETURN', label: 'Asset Return Record', detail: 'Assets returned to custody.', formats: ['pdf'] as const },
  { value: 'PHYSICAL_COUNT', label: 'Physical Count Summary', detail: 'Assets on the books, with condition and location. Disposed assets are left out.', formats: ['pdf', 'excel'] as const },
  { value: 'DISPOSAL', label: 'Disposal Documentation Report', detail: 'Assets flagged for disposal or disposed.', formats: ['pdf'] as const },
  { value: 'REPAIR_HISTORY', label: 'Repair History', detail: 'Repairs with turnaround, outcome and repeat repairs.', formats: ['pdf', 'excel'] as const },
];

export function ReportsContent({
  eyebrow,
  reportTypes,
  pageTitle = 'Generate Reports',
  panelTitle = 'Management Reports',
}: Readonly<{ eyebrow: string; reportTypes?: string[]; pageTitle?: string; panelTitle?: string }>) {
  const REPORT_TYPES = reportTypes ? ALL_REPORT_TYPES.filter((r) => reportTypes.includes(r.value)) : ALL_REPORT_TYPES;
  const [selectedReport, setSelectedReport] = useState('');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const currentReport = REPORT_TYPES.find((r) => r.value === selectedReport);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const blob = await reportsApi.generate({ reportType: selectedReport, format });
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      downloadBlob(blob, `${selectedReport}-${new Date().toISOString().slice(0, 10)}.${ext}`);
      setSuccess(`${currentReport?.label} downloaded.`);
    } catch (err) {
      setError(await apiErrorMessage(err, 'Could not generate the report. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow={eyebrow} title={pageTitle} detail="Reports are generated from live records at the moment you download them." />
      <Panel title={panelTitle} detail={`${REPORT_TYPES.length} ${REPORT_TYPES.length === 1 ? 'report' : 'reports'} available`}>
        <form onSubmit={(event) => void handleGenerate(event)} className="space-y-5 p-4">
          {error && <Notice tone="red">{error}</Notice>}
          {success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div>}

          <fieldset>
            <legend className="mb-2 text-xs font-bold text-slate-600">Report</legend>
            <div className="grid gap-3 md:grid-cols-2">
              {REPORT_TYPES.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-700 ${
                    selectedReport === r.value ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    value={r.value}
                    checked={selectedReport === r.value}
                    onChange={() => {
                      setSelectedReport(r.value);
                      setFormat(r.formats[0]);
                    }}
                    className="mt-1 accent-blue-700"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-950">{r.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{r.detail}</span>
                  </span>
                  <Chip className="uppercase">{r.formats.join(' / ')}</Chip>
                </label>
              ))}
            </div>
          </fieldset>

          {currentReport && currentReport.formats.length > 1 && (
            <fieldset>
              <legend className="mb-2 text-xs font-bold text-slate-600">Format</legend>
              <div className="flex gap-2">
                {currentReport.formats.map((f) => (
                  <label
                    key={f}
                    className={`flex h-9 cursor-pointer items-center rounded-md border px-4 text-sm font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-700 ${
                      format === f ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="sr-only" />
                    {f.toUpperCase()}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="border-t border-slate-100 pt-4">
            <PrimaryButton type="submit" icon={Download} disabled={loading || !selectedReport}>
              {loading ? 'Generating…' : 'Generate report'}
            </PrimaryButton>
          </div>
        </form>
      </Panel>
    </div>
  );
}
