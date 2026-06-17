'use client';

import { useState } from 'react';
import { BarChart2, Download } from 'lucide-react';
import { reportsApi } from '@/lib/api/reports';
import { PageHeader } from '@/components/ui/PageHeader';

const REPORT_TYPES = [
  { value: 'ASSET_MASTER_LIST', label: 'Asset Master List', formats: ['pdf', 'excel'] as const },
  { value: 'REQUISITION_HISTORY', label: 'Requisition History Log', formats: ['pdf', 'excel'] as const },
  { value: 'ASSET_ISSUANCE', label: 'Asset Issuance Record', formats: ['pdf'] as const },
  { value: 'ASSET_RETURN', label: 'Asset Return Record', formats: ['pdf'] as const },
  { value: 'PHYSICAL_COUNT', label: 'Physical Count Summary', formats: ['pdf', 'excel'] as const },
  { value: 'DISPOSAL', label: 'Disposal Documentation Report', formats: ['pdf'] as const },
];

export function ReportsContent() {
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
      await reportsApi.generate({ type: selectedReport, format });
      setSuccess(`${currentReport?.label} (${format.toUpperCase()}) is being generated and will be available shortly.`);
    } catch {
      setError('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Generate Reports" />
      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">Management Reports</h2>
        </div>
        <form onSubmit={handleGenerate} className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-4 py-3">{success}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <div className="space-y-2">
              {REPORT_TYPES.map((r) => (
                <label key={r.value} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedReport === r.value ? 'border-[#1a4d7a] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="reportType" value={r.value} checked={selectedReport === r.value} onChange={() => { setSelectedReport(r.value); setFormat(r.formats[0]); }} />
                  <span className="text-sm text-gray-800">{r.label}</span>
                  <span className="ml-auto text-xs text-gray-400">{r.formats.join(' / ').toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>
          {currentReport && currentReport.formats.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
              <div className="flex gap-3">
                {currentReport.formats.map((f) => (
                  <label key={f} className={`flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer text-sm transition-colors ${format === f ? 'border-[#1a4d7a] bg-blue-50 text-[#1a4d7a] font-medium' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                    <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="sr-only" />
                    {f.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="pt-2">
            <button type="submit" disabled={loading || !selectedReport} className="flex items-center gap-2 bg-[#1a4d7a] text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-60 transition-colors">
              <Download className="w-4 h-4" />
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
